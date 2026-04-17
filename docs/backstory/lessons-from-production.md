# Lessons from Production: The Castle We Didn't Need

RBTC didn't start as a clean pattern. It started as a cleanup after a real production failure. This is the story of what went wrong, what we learned, and how those lessons shaped every design decision in RBTC.

## The Problem

April 2026. We were building the MCP server — a Cloudflare Worker exposing a mid-market company's business data as MCP tools via the Model Context Protocol. Claude.ai had just shipped MCP connectors, letting users connect Claude to external tool servers via OAuth.

When a user connected Claude to the dashboard project, the OAuth flow went:

```
Claude.ai → Supabase OAuth Server → the dashboard project /login → sign in → /oauth/consent → Allow → back to Claude
```

The `/login` page looked identical whether the user came from Claude or visited directly. No indication they were mid-OAuth. The feedback from the project lead: **"This doesn't look legit. It looks like phishing."**

Fair. Google, GitHub, and Microsoft all show the requesting app's identity on their login page during OAuth flows. We should too.

## The Castle

The goal was simple: show "Claude is requesting access" on the login page.

The approach was not simple. We built:

1. **`resolveOAuthContext`** — a server-side resolver that called `/auth/v1/admin/oauth/authorizations/{id}` on Supabase's admin API to fetch the requesting OAuth client's details (name, logo, redirect URI, scopes).

2. **`OAuthFlowBanner`** — a React component with a contained-frame design (rhea-debated, per a 3-model Socratic debate about phishing UX).

3. **`/api/oauth/authorization/[id]/public`** — a scoped public endpoint returning sanitized client info, rate-limited 30/min/IP, with ambiguous 404s to prevent enumeration.

4. **First-party accent system** — env-var-driven allowlist (`OAUTH_FIRST_PARTY_HOSTS`) for distinguishing the dashboard project-owned tools from external DCR clients. Green-tinted border + filled shield-check icon for first-party.

5. **Dev-preview routes** — `/_dev/oauth-preview` rendering the banner with synthetic context objects for visual QA.

6. **236 unit tests** — covering extraction edge cases, resolver happy paths, adversarial inputs (XSS-shaped logos, prototype-property leaks, URL-encoded backslash injection, CRLF, you name it).

7. **5 rounds of commits**, iterating on copy, layout, mobile responsiveness, logo fallback (onError → initial-letter avatar), escape hatch ("Didn't start this? Close this tab to cancel").

Total: **2,400 lines of code across 11 files.**

## The Discovery

After merging to production, we generated a real OAuth authorize URL and clicked it. The browser landed on the dashboard project's `/login` page.

**No banner. Plain "Sign in" page. Identical to a direct visit.**

The resolver had silently returned `null`, and the banner didn't render.

## The Root Cause

```
/auth/v1/admin/oauth/authorizations/{id}
```

**This endpoint does not exist on Supabase.**

The resolver was calling an admin API path that we *assumed* existed because a similar pattern (`/auth/v1/admin/oauth/clients`) did exist. Pattern-matching from one endpoint to an imagined sibling. Classic API hallucination.

The 236 unit tests all passed because every one of them mocked `fetch()` with the response shape we *expected* the endpoint to return. We never made a single real HTTP call to verify the endpoint existed.

```typescript
// What we tested (mocked)
globalThis.fetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    client_id: "claude-dcr-client",
    scope: "openid profile email",
    redirect_uri: "https://claude.ai/callback",
    client: { client_name: "Claude", logo_uri: "..." },
  }),
}));

// What production returned
// HTTP 404 Not Found
```

One `curl` against the real endpoint would have returned 404 in 30 seconds. Instead, we built 2,400 lines of code, 236 tests, 5 rounds of visual QA with synthetic data, and merged to production — all on an assumption that was falsified by one HTTP call we never made.

## The Fix

The project lead asked: **"There's only one place that would possibly send someone to this URL, right? Why can't the referral be there for us?"**

The authorization_id was already in the URL: `?next=/oauth/consent?authorization_id=...`. Its presence means "user is mid-OAuth." That's the signal. No resolver needed. No admin API. No fetch.

```typescript
// The entire fix
const inOAuthFlow = params.next?.includes("/oauth/consent") ?? false;
```

Three lines. Driven from what was already in the URL. The specific requesting app's identity (Claude's name, logo, scopes) renders on `/oauth/consent` — the post-auth page where we DO have a user session and CAN call the Supabase SDK. That page was already working.

We deleted 2,007 lines. Kept 149 tests (the adversarial security tests caught real bugs — open-redirect via URL-encoded backslash, prototype property leak in RBAC, scope DoS, etc. — those were worth keeping regardless of the banner).

## How This Shaped RBTC

Every design decision in RBTC is a direct response to a failure mode from the castle:

### 1. Verify before mocking

The castle tested against mocked endpoints that didn't exist. RBTC's resolver pattern was designed after we verified `user_roles` responds correctly with a real `curl`:

```bash
# We ran this BEFORE writing the resolver
psql "$DATABASE_URL" -c "SELECT role, entities FROM user_roles LIMIT 3"
```

Three rows came back. Then we wrote the code.

### 2. FAIL_CLOSED

The castle's resolver returned `null` silently when the admin endpoint 404'd. The banner just... didn't render. Nobody noticed for 3 days.

RBTC's `FAIL_CLOSED` is the same pattern, but intentional and documented: when role resolution fails, no role-gated tools are visible. Business tools still work. The difference: we *designed* for this case instead of *stumbling into it*.

### 3. Single source of truth

The castle tried to fetch client identity from an admin endpoint that was separate from the consent page's own data source. Two code paths, two assumptions, one of which was wrong.

RBTC reads from `user_roles` — the same table the dashboard reads from. One source, two consumers, zero drift.

### 4. Don't build scaffolding around unverified assumptions

The castle's error was building 2,400 lines on an API assumption. RBTC's resolver is ~50 lines that query a table we know exists. The `createRbtc` helpers are ~40 lines of conditional registration. The test suite verifies the pure logic, not mocked external calls.

Total RBTC implementation: **~100 lines of logic.** Not because we were lazy — because we asked "what's the minimum signal?" before building.

### 5. Dev-preview with synthetic data is not verification

The castle had beautiful dev-preview routes with hardcoded `OAuthClientContext` objects. The banner rendered perfectly in preview. It rendered nothing in production. The preview confirmed what it was designed to confirm — not what mattered.

RBTC's test suite tests pure functions (resolver logic, role matching, tool registration gating) that don't depend on external state. The external dependency (DB query) is verified once with a real call, then the pure logic is tested exhaustively.

## The Lessons, Codified

These became formal engineering learnings (stored in the team's persistent memory):

1. **One real HTTP call before writing the first mock.** If the endpoint 404s, you know in 30 seconds instead of 3 days.

2. **Ask "what's the minimum signal I need?" before building.** The URL already carried the signal. The admin API was answering a question nobody needed to ask.

3. **Dev-preview with synthetic context is a mock with fancier rendering.** The verification that matters starts from the real upstream trigger and follows the real path.

4. **Mocked tests prove the code handles a shape. They don't prove the shape exists.** These are different kinds of knowledge. Conflating them is how 236 passing tests coexist with a feature that doesn't work.

5. **When the tool errors, debug the tool — don't fall back to the raw command.** (This one came later, when we built a ceremony-guard hook to enforce it.)

## Why This Story Matters for RBTC

If you're evaluating RBTC for your MCP server, the pattern's simplicity is a feature, not a limitation. It's simple because we already tried the complex version and it didn't work. Every line of RBTC exists because a simpler approach was verified against reality first.

The castle was 2,400 lines built on an assumption. RBTC is ~100 lines built on a verified query. The difference isn't engineering skill — it's the order of operations: verify first, then build.
