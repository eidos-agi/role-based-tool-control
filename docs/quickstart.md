# Quick Start: Add RBTC to an Existing MCP Server

You have an MCP server. It registers tools. You want tools to appear or disappear based on who's calling. This takes about 10 minutes.

## Before RBTC

Your server registers all tools unconditionally:

```typescript
function buildServer(): McpServer {
  const server = new McpServer({ name: "my-mcp", version: "1.0" });

  server.registerTool("get_data", { ... }, handler);
  server.registerTool("admin_panel", { ... }, handler);  // everyone sees this
  server.registerTool("export_secrets", { ... }, handler); // everyone sees this too

  return server;
}
```

Every connected client — regardless of role — sees `admin_panel` and `export_secrets` in `tools/list`.

## After RBTC (10-minute version)

### Step 1: Know who's calling

You need the caller's identity before building the server. If you already validate JWTs, you have a `sub` claim. Pass it through.

```typescript
// Before: buildServer takes no identity
function buildServer(): McpServer { ... }

// After: buildServer takes the authenticated caller's info
async function buildServer(callerSub: string): Promise<McpServer> { ... }
```

### Step 2: Resolve their role

Write a function that turns a user ID into a role. This is your `RoleResolver`.

**Simplest possible version (hardcoded for testing):**
```typescript
async function resolveRole(sub: string) {
  const roles: Record<string, string> = {
    "user-001": "admin",
    "user-002": "viewer",
  };
  return roles[sub] ? { role: roles[sub] } : null;
}
```

**Real version (from your database):**
```typescript
async function resolveRole(sub: string) {
  const row = await db.query("SELECT role FROM users WHERE id = $1", [sub]);
  return row ? { role: row.role } : null;
}
```

### Step 3: Gate tool registration

```typescript
async function buildServer(callerSub: string): Promise<McpServer> {
  const server = new McpServer({ name: "my-mcp", version: "1.0" });

  // Resolve role
  const result = await resolveRole(callerSub);
  const role = result?.role ?? "";
  const isAdmin = ["admin", "superadmin"].includes(role);

  // Helper: register only if admin
  function registerAdmin(name, config, handler) {
    if (isAdmin) server.registerTool(name, config, handler);
  }

  // Everyone
  server.registerTool("get_data", { ... }, handler);

  // Admin only
  registerAdmin("admin_panel", { ... }, handler);
  registerAdmin("export_secrets", { ... }, handler);

  return server;
}
```

That's it. When a viewer connects, they see 1 tool. When an admin connects, they see 3.

### Step 4: Wire it into your request handler

```typescript
// Before
const handler = createMcpHandler(buildServer(), { ... });

// After
const handler = createMcpHandler(await buildServer(authenticatedUser.sub), { ... });
```

## Using the @eidos-agi/rbtc package

The package gives you a cleaner API for step 2 + 3:

```bash
npm install @eidos-agi/rbtc
```

```typescript
import { resolveRoles, createRbtc } from "@eidos-agi/rbtc";

async function buildServer(callerSub: string): Promise<McpServer> {
  const server = new McpServer({ name: "my-mcp", version: "1.0" });

  const roles = await resolveRoles(callerSub, myResolver, ["admin", "superadmin"]);
  const rbtc = createRbtc({
    roles,
    register: (name, config, handler) => server.registerTool(name, config, handler),
    adminRoles: ["admin", "superadmin"],
  });

  rbtc.everyone("get_data", { ... }, handler);
  rbtc.admin("admin_panel", { ... }, handler);
  rbtc.admin("export_secrets", { ... }, handler);
  rbtc.ifRole(["analyst"], "run_report", { ... }, handler);

  return server;
}
```

## What you get

| Before | After |
|---|---|
| Claude proposes admin tools to viewers | Claude only sees tools the user can call |
| 403 errors mid-conversation | No dead-ends — the tool wasn't in the manifest |
| Audit log has unauthorized attempts | Every logged call was authorized by definition |
| One manifest for all users | Per-caller manifest, one connector |

## Common questions

**"Do I need to change my auth?"** No. RBTC uses whatever identity you already have. If you validate JWTs, you have a `sub`. That's all you need.

**"What if my role store is slow?"** Role resolution runs once per session (on `tools/list`), not per tool call. One DB query per connection. Cache if needed, but it's rarely the bottleneck.

**"What if the role lookup fails?"** Return null from your resolver. RBTC defaults to FAIL_CLOSED: no role-gated tools visible, business tools still work. Safe degradation.

**"Can I test this locally?"** Yes. Use a hardcoded resolver that returns different roles for different test users. The `createRbtc` function doesn't care where the role came from.

**"Does this work with Python MCP servers?"** The pattern works in any language. The `@eidos-agi/rbtc` package is TypeScript, but the concept — "conditionally register tools based on resolved role" — is language-agnostic. See the README for the pseudocode pattern.
