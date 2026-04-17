# Scope Narrowing: Beyond Show/Hide

Basic RBTC gates tool **visibility** — admin sees `delete_user`, viewer doesn't. But the most powerful application is **scope narrowing**: the same tool exists for multiple roles, but its input schema, description, and data access adapt per-caller.

## The Idea

A CFO and a regional manager both need `get_revenue`. But:

- The CFO should query any entity (Region A, Region B, Consolidated)
- The regional manager should only query their assigned region

Instead of building two tools (`get_revenue_cfo` + `get_revenue_regional`), build one tool whose input schema narrows based on the caller's `entities` scope.

## Pattern: Dynamic Input Schema

```typescript
const rbtc = createRbtc({ roles, register, adminRoles: ["admin"] });

// The entity param changes based on who's calling
const entitySchema = roles.entities.includes("*")
  ? z.enum(["region_a", "region_b", "consolidated"])  // wildcard → full choice
  : z.enum(roles.entities as [string, ...string[]]); // scoped → locked

rbtc.everyone(
  "get_revenue",
  {
    title: "Get revenue for a period",
    description: roles.entities.includes("*")
      ? "Revenue for any entity. You have full access."
      : `Revenue for ${roles.entities.join(", ")}. Scoped to your assigned entities.`,
    inputSchema: {
      entity: entitySchema,
      period: z.string().regex(/^\d{4}-\d{2}$/),
    },
  },
  handler,
);
```

Now the tool manifest itself tells the AI what's allowed:

| Caller | Schema for `entity` | Description |
|---|---|---|
| Admin (entities: `["*"]`) | `enum: ["region_a", "region_b", "consolidated"]` | "Revenue for any entity. You have full access." |
| Region A manager (entities: `["region_a"]`) | `enum: ["region_a"]` | "Revenue for region_a. Scoped to your assigned entities." |
| Multi-entity (entities: `["region_a", "region_b"]`) | `enum: ["region_a", "region_b"]` | "Revenue for region_a, region_b." |

The AI literally cannot pass `entity: "region_b"` for an Region A-only manager — it's not in the schema's enum.

## Pattern: Dynamic Description

Even when the schema stays the same, the description should adapt:

```typescript
rbtc.everyone(
  "search_deals",
  {
    description: roles.admin
      ? "Search all deals across the org. Includes private notes, commission data, and internal flags."
      : roles.roles.includes("cro")
        ? "Search deals you own or are CC'd on. Includes pipeline stage and expected close."
        : "Search active deals visible to your team.",
  },
  handler,
);
```

The AI uses the description to decide **when** to call the tool and **how** to present results. A viewer's description that mentions "private notes" would be misleading — the data won't contain them, but the AI might promise they're there.

## Pattern: Response Filtering

Sometimes the schema is the same but the **response** should omit fields:

```typescript
async function handleGetDeal({ deal_id }) {
  const deal = await fetchDeal(deal_id);

  // Strip sensitive fields for non-admin callers
  if (!roles.admin) {
    delete deal.commission_rate;
    delete deal.internal_notes;
    delete deal.competitor_intel;
  }

  // Strip PII for non-management callers
  if (!roles.roles.some(r => ["admin", "cro", "manager"].includes(r))) {
    delete deal.contact_email;
    delete deal.contact_phone;
  }

  return { content: [{ type: "text", text: JSON.stringify(deal) }] };
}
```

This is response-level RBTC — the tool exists for everyone, the schema is identical, but the data that comes back respects the caller's tier.

## Combining Visibility + Scope

The full RBTC stack has three layers:

```
Layer 1: Tool visibility     → "Can you see this tool?"          (register_admin, ifRole)
Layer 2: Input narrowing      → "What can you ask for?"          (dynamic schema)
Layer 3: Response filtering   → "What comes back?"               (field stripping)
```

Each layer is defense-in-depth for the layers above:
- If visibility gating has a bug and a viewer sees `export_payroll`, the input schema might still lock them to their own entity
- If the schema has a bug and they can request any entity, the response filter strips the sensitive fields
- If all three fail, RLS in the database is the final gate

## Anti-Pattern: Don't Over-Narrow

```typescript
// ❌ Too narrow — kills usefulness
rbtc.everyone("get_metric", {
  inputSchema: {
    metric_id: z.enum(allowedMetricsForRole(roles)),  // 3 metrics for viewer
  },
});

// ✅ Better — let the AI discover, fail gracefully on unauthorized
rbtc.everyone("get_metric", {
  inputSchema: {
    metric_id: z.string().regex(/^MTR-[A-Z]{3}-\d{3}$/),
  },
  description: `Query any metric by ID. You have access to ${allowedMetricsForRole(roles).length} metrics. Call list_metrics to see which ones.`,
});
```

Over-narrowing the schema makes the AI's job harder — it can't discover what's available. Better to let discovery tools (like `list_metrics`) show the scope, and let the data layer enforce access. Reserve schema narrowing for things like entity scope where the constraint is absolute.

## When to Use Each Layer

| Situation | Layer | Example |
|---|---|---|
| Tool is irrelevant to this role | **Visibility** | Viewer can't see `delete_user` |
| Tool exists but data access differs | **Input narrowing** | Region A manager can't request Region B data |
| Tool exists, schema is same, but response has sensitive fields | **Response filtering** | Viewer doesn't see commission rates |
| Tool exists and works identically for all roles | **None** — just `rbtc.everyone()` | `list_metrics` returns the same catalog |
