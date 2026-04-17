# Changelog

All notable changes to this project are documented here.

## [0.1.0] — 2026-04-17

### Added

**Core library (`src/`)**
- `resolveRoles()` — pluggable role resolution with custom `RoleResolver` interface
- `createRbtc()` — returns `everyone()`, `admin()`, `ifRole()`, `ifPredicate()` helpers
- `FAIL_CLOSED` — frozen safe-default constant
- Full TypeScript types with JSDoc

**Documentation (`docs/`)**
- [Quick Start](docs/quickstart.md) — add RBTC in 10 minutes
- [Case Study: Supabase](docs/case-study-supabase.md) — single source of truth, RLS complement
- [Case Study: Cloudflare Workers](docs/case-study-cloudflare-workers.md) — per-request isolation
- [Scope Narrowing](docs/scope-narrowing.md) — dynamic schemas, descriptions, response filtering
- [RBTC vs Alternatives](docs/vs-alternatives.md) — 5 approaches compared
- [Security Model](docs/security-model.md) — threat model + 4-layer defense stack
- [Lessons from Production](docs/lessons-from-production.md) — the 2,400-line castle failure
- [Delegation](docs/delegation.md) — temporary tool grants
- [Building with Loops](docs/building-with-loops.md) — how this repo was built iteratively
- [What Claude Sees](docs/what-claude-sees.md) — real conversation examples with/without RBTC

**Examples**
- Supabase resolver (TypeScript)
- Cloudflare Worker with full RBTC wiring (TypeScript)
- Node.js/Express per-session RBTC (TypeScript)
- Python decorator-based RBTC with psycopg2 (Python)

**Tests**
- 34 assertions covering `resolveRoles`, `FAIL_CLOSED`, `createRbtc` with admin/cfo/gm/viewer/empty roles

**Meta**
- CONTRIBUTING.md — wanted resolvers, examples, docs
- MIT license
- npm-publishable as `@eidos-agi/rbtc`
