# RBTC vs Alternatives

You need to control who can use which MCP tools. Here are five approaches, with honest tradeoffs.

## Approach 1: No gating (the default)

Register all tools. Hope for the best.

```typescript
server.registerTool("delete_user", config, handler);
// Everyone sees this. Everyone can try to call it.
```

**What happens:** Claude proposes `delete_user` to a viewer. The handler returns 403. Claude apologizes and tries something else. The user sees a broken experience. The audit log records an unauthorized attempt.

| Pros | Cons |
|---|---|
| Zero implementation effort | AI proposes tools users can't call |
| | 403 dead-ends mid-conversation |
| | Audit log polluted with unauthorized attempts |
| | AI might retry with different phrasing, wasting turns |

**Verdict:** Only acceptable for single-user or single-role deployments.

## Approach 2: Execution-time authorization

Register all tools. Check permissions inside each handler.

```typescript
server.registerTool("delete_user", config, async (args) => {
  if (!isAdmin(caller)) return { content: [{ type: "text", text: "Forbidden" }], isError: true };
  // ... actual logic
});
```

**What happens:** Claude sees `delete_user` in the manifest, might propose it. When it calls the handler, the permission check blocks it. Better than approach 1 because the error is explicit, but the AI still wastes a turn.

| Pros | Cons |
|---|---|
| Familiar pattern (middleware-style) | Tool visible to all → AI might propose it |
| Defense-in-depth (catches bugs in other layers) | 403/error handling logic in every handler |
| | Audit log still has unauthorized attempts |
| | AI's reasoning includes tools user can't use |

**Verdict:** Necessary as a second layer, but insufficient alone.

## Approach 3: Separate MCP endpoints

Run two (or more) servers at different URLs. Admin tools live on `/admin/mcp`.

```
/mcp        → business tools (everyone)
/admin/mcp  → admin tools (admin only)
```

**What happens:** Users connect to the endpoint matching their role. Each has its own manifest. Clean separation.

| Pros | Cons |
|---|---|
| Complete manifest isolation | Users must know which endpoint to connect |
| Different OAuth scopes per endpoint | N endpoints = N connectors in claude.ai |
| Easy to reason about | Shared code (auth, helpers) duplicated or factored into a library |
| | Roles that span tiers (viewer + one admin tool) require awkward endpoint choices |
| | Scaling: 5 roles × 3 access tiers = combinatorial explosion of endpoints |

**Verdict:** Good for coarse-grained separation (public vs admin). Doesn't scale to fine-grained role-based visibility.

## Approach 4: RBTC — manifest-level gating

Build the MCP server per-session. Resolve the caller's role. Register tools conditionally.

```typescript
async function buildServer(callerSub) {
  const roles = await resolveRoles(callerSub, resolver);
  const rbtc = createRbtc({ roles, register });

  rbtc.everyone("get_data", config, handler);
  rbtc.admin("delete_user", config, handler);

  return server;
}
```

**What happens:** Each caller gets a tailored manifest. Viewer sees 10 tools. Admin sees 15. Same endpoint, same connector. The AI can only propose tools the user can actually call.

| Pros | Cons |
|---|---|
| AI can't propose unauthorized tools | One DB query per session (role lookup) |
| Zero 403 dead-ends | Per-request server creation (minor overhead) |
| Audit trail is trivially honest | Tool list varies per-user (harder to document) |
| One connector, N surfaces | Requires async server construction |
| Scales to any number of roles | |

**Verdict:** The right default for multi-role MCP servers. Combine with approach 2 for defense-in-depth.

## Approach 5: OAuth scope gating

Use the OAuth consent scopes (e.g., `mcp:read` vs `mcp:write`) to gate tool categories.

```typescript
if (oauthScopes.includes("mcp:write")) {
  register("update_deal", config, handler);
}
```

**What happens:** The user consented to specific scopes during the OAuth flow. Tools that require unconsented scopes aren't registered.

| Pros | Cons |
|---|---|
| User explicitly consented | Scopes are coarse (read/write/admin) |
| Standard OAuth pattern | Can't express "CFO sees financial tools" |
| Works across MCP clients | Scope changes require re-consent (new OAuth flow) |

**Verdict:** Complementary to RBTC. Scopes gate **what the user consented to**; roles gate **what the user's job allows**. Use both.

## Comparison matrix

| | No gating | Execution-time | Separate endpoints | **RBTC** | OAuth scopes |
|---|---|---|---|---|---|
| AI sees only callable tools | ❌ | ❌ | ✅ | **✅** | ✅ |
| No 403 dead-ends | ❌ | ❌ | ✅ | **✅** | ✅ |
| Single connector | ✅ | ✅ | ❌ | **✅** | ✅ |
| Fine-grained (per-role) | ❌ | ✅ (at call time) | ❌ | **✅** | ❌ |
| Dynamic per-user | ❌ | ❌ | ❌ | **✅** | ❌ |
| Defense-in-depth | ❌ | ✅ | ✅ | **partial** | ✅ |
| Implementation cost | None | Low | Medium | **Low** | Medium |

## Recommended stack

Use RBTC (approach 4) as the primary gate + execution-time checks (approach 2) as defense-in-depth + OAuth scopes (approach 5) for consent boundaries.

```
Layer 1: OAuth scopes    → "What did the user consent to?"     (consent-time)
Layer 2: RBTC            → "What should the user see?"         (session-init)
Layer 3: Handler checks  → "Is this specific call allowed?"    (call-time)
Layer 4: Database RLS    → "Can this user read this row?"      (query-time)
```

Each layer catches bugs in the layers above. The user experiences layer 2 (RBTC) — a clean, focused tool surface. Layers 1, 3, and 4 are invisible safety nets.
