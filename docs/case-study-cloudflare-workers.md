# Case Study: RBTC on Cloudflare Workers

Cloudflare Workers are an excellent host for RBTC-enabled MCP servers because the per-request execution model naturally aligns with per-caller manifest building.

## Architecture

```
Claude.ai → Cloudflare Worker (edge) → Supabase / your DB (origin)
                │
                ├─ validateBearer()  → JWT verified via JWKS
                ├─ resolveRoles()    → DB lookup for caller's role
                ├─ buildServer()     → McpServer with per-caller tools
                └─ createMcpHandler() → dispatch tools/list + tools/call
```

Every request creates a fresh `McpServer` instance. There's no shared state between callers — each gets their own manifest, their own tool set, their own audit context. This is RBTC's natural habitat.

## Why Workers for MCP?

### Per-request isolation is free

In a long-running Node.js server, you'd need to manage tool manifests per-session (tricky — MCP SDK's `McpServer` registers tools once). On Workers, the server is rebuilt from scratch on every request. Per-caller tool registration is the *default*, not a pattern you have to engineer.

### Edge latency

The Worker runs at the nearest Cloudflare POP. JWT validation uses cached JWKS. The only origin round-trip is the role lookup — one Supabase query. Total latency for `tools/list`: ~50ms (JWT verify) + ~100ms (role query) = ~150ms. Acceptable for a session-init call that runs once.

### No cold-start concern for RBTC

Workers have minimal cold starts (~5ms). The role resolution adds ~100ms on top. Since `tools/list` is called once per session (not per turn), this is invisible to the user.

### Secrets management

Worker secrets (`wrangler secret put`) store the Supabase service-role key, GitHub PAT, telemetry ingest token, etc. These never appear in source code, aren't in the bundle, and are encrypted at rest. The RBTC resolver reads `env.SUPABASE_SERVICE_ROLE_KEY` — available in the handler, not globally.

## Design decisions specific to Workers

### buildServer must be async

```typescript
// ✅ Correct: async, awaits role resolution
async function buildServer(env, ctx, props): Promise<McpServer> {
  const roles = await resolveRoles(props.sub, resolver);
  // ... register tools based on roles ...
  return server;
}

// ❌ Wrong: synchronous, can't await role resolution
function buildServer(env, ctx, props): McpServer {
  // resolveRoles is async — can't call it here without await
}
```

This is a Workers-specific consideration. The `createMcpHandler` from `agents/mcp` accepts a synchronous `McpServer`, so you await `buildServer` before passing it:

```typescript
const mcpServer = await buildServer(env, ctx, result.props);
const handler = createMcpHandler(mcpServer, { authContext: { props } });
return handler(request, env, ctx);
```

### One Worker, multiple MCP personas

A single Worker can serve multiple MCP endpoints:

```typescript
if (url.pathname === "/mcp") {
  return handleBusinessMcp(request, env, ctx);
}
if (url.pathname === "/admin/mcp") {
  return handleAdminMcp(request, env, ctx);
}
```

With RBTC, this split is usually unnecessary — admin tools gate themselves. But if you want completely separate OAuth scopes (business = `mcp:read`, admin = `mcp:admin`), separate endpoints let you require different scopes at the consent stage.

### ctx.waitUntil for telemetry

Workers have a 30-second CPU limit. Tool handlers should return quickly and push slow side-effects (telemetry, audit logging) into `ctx.waitUntil`:

```typescript
const wrapped = async (args) => {
  const t0 = Date.now();
  const result = await handler(args);
  ctx.waitUntil(emitTelemetry({
    tool: name,
    role: roles.roleId,
    latency: Date.now() - t0,
  }));
  return result;
};
```

RBTC's role information enriches telemetry: every event carries the caller's resolved role, not just their sub.

## Gotchas

### Don't cache the McpServer across requests

```typescript
// ❌ Shared server = shared manifest = RBTC bypassed
let cached: McpServer;
export default {
  fetch(request, env, ctx) {
    if (!cached) cached = buildServer(env, ctx, someProps);
    // Every caller gets the first caller's manifest
  }
};
```

Workers already handle this correctly if you build inside `fetch`. Just don't try to optimize by caching the server.

### JWKS caching IS safe

Unlike the McpServer, the JWKS (JSON Web Key Set) used for JWT validation SHOULD be cached across requests:

```typescript
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function getJwks(supabaseUrl: string) {
  if (!jwksCache.has(supabaseUrl)) {
    jwksCache.set(supabaseUrl, createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)));
  }
  return jwksCache.get(supabaseUrl)!;
}
```

JWKS is the same for all callers. Caching it avoids a network round-trip on every request.

### Service-role key scope

The `SUPABASE_SERVICE_ROLE_KEY` should ONLY be used for role resolution (reading `user_roles`). Business tool handlers should use the caller's JWT to create a user-scoped Supabase client:

```typescript
// Role resolution — service-role key (reads any user's role)
const admin = createClient(url, serviceRoleKey);

// Tool handler — user's JWT (respects RLS)
const userClient = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${props.jwt}` } },
});
```

This keeps RBTC's admin query scoped to one table, while business data queries follow the user's actual permissions.

## Cost

Workers are billed per-request + CPU time. RBTC adds:
- ~1ms CPU for role resolution logic (negligible)
- ~100ms wall time for the Supabase query (one per session)
- ~0 additional cost at typical MCP usage volumes (hundreds of calls/day, not millions)

The role-lookup Supabase query is a single-row primary-key lookup with an index — effectively free on Supabase's side.

## Production reference

This pattern runs in production at [the MCP server](https://your-mcp.workers.dev) — a Cloudflare Worker serving a mid-market company's business data as MCP tools. 6 role-gated tools across admin/business tiers, 82 unit assertions, verified end-to-end with real Claude.ai connector flows.
