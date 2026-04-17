# Contributing to RBTC

RBTC is a pattern, not a framework. Contributions that make the pattern more accessible, more portable, or better tested are welcome.

## What we're looking for

### Resolvers for other auth providers

The `examples/` directory has resolvers for Supabase and raw SQL. We'd love:

- **Auth0** — using the Management API to read roles
- **Clerk** — using Clerk's metadata API
- **Firebase Auth** — using custom claims
- **Keycloak** — using realm roles
- **AWS Cognito** — using group membership
- **Plain JWT** — reading roles from `app_metadata` or custom claims without a DB lookup

Each resolver should:
- Live in `examples/<provider>-resolver.ts` (or `.py`)
- Implement the `RoleResolver` interface (or its language equivalent)
- Handle the FAIL_CLOSED case (return null on any error)
- Include a usage comment showing how to wire it into `createRbtc`

### MCP server examples

Show RBTC working in different runtime environments:

- **Deno** — for Deno Deploy MCP servers
- **AWS Lambda** — per-invocation model (similar to Workers)
- **Railway / Fly.io** — long-running Node.js with per-session RBTC
- **FastAPI** — Python MCP server with RBTC
- **Go** — for go-mcp servers

### Deep-dive docs

Expand the `docs/` directory:

- **Delegation patterns** — temporary tool grants, time-bounded, auditable
- **Multi-tenant RBTC** — when the same MCP server serves multiple orgs
- **Progressive disclosure** — unlock tools based on usage patterns
- **Monitoring and alerting** — detecting role-resolution anomalies

## How to contribute

1. Fork the repo
2. Create a branch (`feat/auth0-resolver`, `docs/delegation`, etc.)
3. Add your code/docs
4. If adding code: include at least one test or a runnable example
5. Open a PR with a clear description of what and why

## Code style

- TypeScript: no semicolons, tabs for indentation, single quotes
- Python: follow PEP 8, type hints on function signatures
- Docs: Markdown, one sentence per line (easier diffs), code blocks with language tags

## Tests

```bash
# Run the test suite
npx tsx tests/rbtc.test.ts

# Build the package
npm run build
```

All tests should pass before submitting. Add tests for new resolvers or core logic changes.

## Not in scope

- **Auth frameworks** — RBTC assumes you already have auth. We don't want to build or bundle JWT validation, session management, etc.
- **MCP SDK wrappers** — we provide helpers that work WITH the SDK, not alternatives to it.
- **UI components** — RBTC is server-side. No React/Vue/Svelte.
