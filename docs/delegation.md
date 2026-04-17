# Delegation: Temporary Tool Grants

Sometimes an admin wants to give a specific user access to one tool without permanently changing their role. That's delegation — time-bounded, auditable, revocable tool grants that layer on top of RBTC's role-based visibility.

## The Problem

Alex is CFO. She can see `export_payroll`. Robert is GM. He can't.

But Robert needs to run one payroll export for a quarterly board review. Options without delegation:

1. **Promote Robert to CFO** — wrong. He doesn't need CFO access to everything. Just one tool, once.
2. **Create a "gm+payroll" composite role** — role explosion. Next month someone needs "viewer+pipeline." Then "manager+gl-drilldown."
3. **Just give him the data manually** — works once. Doesn't scale. No audit trail.

## The Pattern

Add a `delegations` table alongside `user_roles`:

```sql
CREATE TABLE tool_delegations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id),
    tool_name   text NOT NULL,
    granted_by  uuid NOT NULL REFERENCES auth.users(id),
    reason      text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,

    CONSTRAINT not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_active_delegations
    ON tool_delegations(user_id, tool_name)
    WHERE revoked_at IS NULL;

ALTER TABLE tool_delegations ENABLE ROW LEVEL SECURITY;
```

## Resolver Integration

Extend the role resolver to also check delegations:

```typescript
interface ResolvedRoles {
    roleId: string;
    roles: string[];
    admin: boolean;
    entities: string[];
    delegatedTools: string[];  // ← new
}

async function resolveCallerRole(sub: string, env: Env): Promise<ResolvedRoles> {
    // ... existing role lookup ...

    // Also fetch active delegations
    const { data: delegations } = await admin
        .from("tool_delegations")
        .select("tool_name")
        .eq("user_id", sub)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString());

    return {
        ...roles,
        delegatedTools: delegations?.map(d => d.tool_name) ?? [],
    };
}
```

## Registration with Delegation

Add a new RBTC helper that checks both role AND delegations:

```typescript
function register_or_delegated(
    roleTier: string[],
    name: string,
    config: ToolConfig,
    handler: ToolHandler,
) {
    // Role-based: caller has the right role
    const hasRole = roles.roles.some(r => [...roleTier, ...adminRoles].includes(r));
    // Delegation-based: caller was granted this specific tool
    const hasDelegation = roles.delegatedTools.includes(name);

    if (hasRole || hasDelegation) {
        register(name, config, handler);
    }
}

// Usage
register_or_delegated(
    ["cfo"],
    "export_payroll",
    { title: "Export payroll data", ... },
    handler,
);
```

Robert (GM) normally doesn't see `export_payroll`. But if there's an active delegation row granting him that tool, it appears in his manifest.

## Granting Delegations

An admin tool for creating delegations:

```typescript
rbtc.admin(
    "delegate_tool",
    {
        title: "Grant temporary tool access to a user (admin only)",
        description: "Creates a time-bounded delegation. The user will see the tool on their next MCP session. Delegation auto-expires. Revoke early with revoke_delegation.",
        inputSchema: {
            user_id: z.string().uuid(),
            tool_name: z.string(),
            hours: z.number().min(1).max(720).default(24),
            reason: z.string(),
        },
    },
    async ({ user_id, tool_name, hours, reason }) => {
        const expires = new Date(Date.now() + hours * 3600_000).toISOString();
        await db.from("tool_delegations").insert({
            user_id,
            tool_name,
            granted_by: callerSub,
            reason,
            expires_at: expires,
        });
        return {
            content: [{
                type: "text",
                text: `Delegated "${tool_name}" to ${user_id} for ${hours}h. Reason: ${reason}. Expires: ${expires}`,
            }],
        };
    },
);
```

The admin tells Claude: *"Give Robert access to export_payroll for 24 hours — he needs it for the board review."* Claude calls `delegate_tool`. Robert's next MCP session includes `export_payroll`.

## Audit Trail

Every delegation is a row with `granted_by`, `reason`, `created_at`, `expires_at`. You can answer:

- *"Who gave Robert payroll access?"* → `granted_by = admin-sub`
- *"Why?"* → `reason = "Q4 board review"`
- *"Is it still active?"* → `expires_at > now() AND revoked_at IS NULL`
- *"How often does this happen?"* → `COUNT(*) GROUP BY tool_name`

If `telemetry_query` is also active, you can correlate: "Robert called `export_payroll` 3 times during his 24h window, all on April 17."

## Properties

| Property | How |
|---|---|
| **Time-bounded** | `expires_at` column. No perpetual delegations. Max 720h (30 days) enforced by schema. |
| **Auditable** | Every grant is a row with who, what, why, when. |
| **Revocable** | `revoke_delegation` tool sets `revoked_at`. Immediate on next session. |
| **Non-escalating** | Delegation grants ONE tool, not a role. Robert gets `export_payroll`, not "everything a CFO sees." |
| **Admin-only granting** | `delegate_tool` is behind `register_admin`. Only admins can create delegations. |
| **Session-scoped** | Delegation takes effect on the user's NEXT session (next `tools/list`). No mid-conversation tool injection. |

## When to Use Delegation vs Role Change

| Scenario | Use |
|---|---|
| Robert needs payroll for one board meeting | **Delegation** (24h, specific tool) |
| Robert is promoted to finance team permanently | **Role change** (update `user_roles`) |
| Contractor needs 3 tools for a 2-week project | **Delegation** (336h, 3 separate grants) |
| New employee joins with standard permissions | **Role assignment** (set `user_roles.role`) |
| Emergency: someone needs admin access NOW | **Delegation** (short window, audited reason) |

## Anti-Patterns

**Don't delegate entire role tiers.** If you find yourself delegating 10 tools to the same user, they probably need a role change. Delegation is for exceptions, not the norm.

**Don't skip the reason field.** "Board review" is searchable and auditable. An empty reason is a mystery 3 months later.

**Don't set max-duration delegations by default.** 720h (30 days) should feel uncomfortable. Most delegations should be 1-24 hours. If you need 30 days, that's a role discussion.
