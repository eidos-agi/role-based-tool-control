# RBTC Security Model

What RBTC protects against, what it doesn't, and where it fits in a defense-in-depth stack.

## Threat model

RBTC operates at the **manifest layer** — between the AI model and the tool handlers. It is NOT:
- An auth framework (you still need JWT validation)
- A database access-control layer (you still need RLS)
- A network security tool (you still need TLS, rate limiting, etc.)

RBTC's job is narrow: **prevent the AI model from seeing or proposing tools the caller isn't authorized to use.** Everything else is handled by other layers.

## What RBTC protects against

### 1. AI-initiated privilege probing

Without RBTC, the model sees all tools and may attempt to call admin tools on behalf of a non-admin user — either because the user asked, or because the model inferred the tool would help.

**With RBTC:** The tool isn't in the manifest. The model can't propose what it can't see. Not in reasoning, not in output, not as a fallback.

### 2. Social engineering via tool discovery

A user asks: "What admin tools do you have?" Without RBTC, the model honestly lists them (they're in the manifest). With RBTC, the model says "I have get_revenue and list_metrics" — because that's all it sees.

### 3. Confused deputy attacks

An AI model acting on behalf of User A proposes a tool that User A shouldn't have. The tool handler might check permissions, but the model already exposed the tool's existence and purpose in its reasoning.

**With RBTC:** The model never learns the tool exists for this session.

### 4. Audit log pollution

Without RBTC, every unauthorized tool call appears as a failed attempt in logs. With many users, this creates noise that obscures real security events.

**With RBTC:** Unauthorized calls can't happen (the tool wasn't registered). Every logged call was authorized at the manifest level.

## What RBTC does NOT protect against

### 1. Compromised JWT / stolen tokens

If an attacker has a valid admin JWT, RBTC resolves their role as admin and shows admin tools. RBTC trusts the identity layer — it doesn't replace it.

**Mitigation:** Short-lived JWTs, token rotation, MFA.

### 2. Bugs in the role resolver

If `resolveCallerRole` returns `admin: true` for a viewer, that viewer sees admin tools. The resolver is the trust root.

**Mitigation:** Unit tests for the resolver (the @eidos-agi/rbtc package includes test patterns). FAIL_CLOSED default means bugs that return null/empty are safe.

### 3. Direct API calls bypassing MCP

If someone calls your Supabase PostgREST endpoints directly (not through MCP), RBTC has no effect. The MCP manifest only gates MCP tool calls.

**Mitigation:** Database RLS. PostgREST queries respect the caller's JWT-scoped permissions regardless of whether MCP is involved.

### 4. Tool handler vulnerabilities

A tool handler with an SQL injection vulnerability is just as exploitable with RBTC as without it. RBTC gates *visibility*, not *implementation quality*.

**Mitigation:** Standard secure coding practices in handlers. Parameterized queries. Input validation.

### 5. Information leakage through tool descriptions

Even with RBTC, the existence of `register_admin` in your source code is visible to anyone who reads the repo. An attacker can learn WHAT admin tools exist (names, descriptions, schemas) from the code — they just can't call them.

**Mitigation:** This is acceptable. Security through obscurity is not a real control. The protection is authorization, not secrecy.

### 6. Race conditions on role changes

If a user's role is changed from admin → viewer while they have an active MCP session, their manifest doesn't update until the next session. The old session retains admin tool visibility.

**Mitigation:** Short session lifetimes. If immediate revocation is critical, implement a session-invalidation mechanism (e.g., check a revocation timestamp in the handler).

## The 4-layer stack

RBTC is strongest as part of a defense-in-depth stack:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: OAuth consent scopes                            │
│ "What did the user agree to share?"                      │
│ Gate: consent-time (OAuth flow)                          │
├─────────────────────────────────────────────────────────┤
│ Layer 2: RBTC — manifest-level gating            ← HERE │
│ "What tools should the user see?"                        │
│ Gate: session-init (tools/list)                          │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Handler-level authorization                     │
│ "Is this specific call allowed?"                         │
│ Gate: call-time (each tools/call)                        │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Database row-level security (RLS)               │
│ "Can this user read/write this row?"                     │
│ Gate: query-time (every SELECT/INSERT/UPDATE)            │
└─────────────────────────────────────────────────────────┘
```

Each layer catches failures in the layers above:
- If OAuth scope check has a bug → RBTC blocks the tool at manifest level
- If RBTC has a bug → handler authorization blocks the call
- If handler has a bug → RLS blocks the data access
- If RLS has a bug → you have a real problem (but 3 layers already failed)

## FAIL_CLOSED as a security property

The most important design decision in RBTC: **when role resolution fails, no role-gated tools are visible.** This is the safe direction:

| Failure mode | Behavior | Risk |
|---|---|---|
| DB down | No admin/CFO/GM tools. Business tools still work. | **Low** — degraded UX, not elevated access |
| User has no role row | Same as above. | **Low** — new users get minimum surface |
| Resolver throws exception | Same as above (caught, returns FAIL_CLOSED). | **Low** — exception = safe default |
| Resolver returns admin for viewer | Viewer sees admin tools. | **HIGH** — this is the bug to test for |

The only dangerous failure mode is the resolver returning MORE access than warranted. This is why resolver unit tests matter — and why FAIL_CLOSED exists as a frozen constant that can't be accidentally mutated.

## Testing recommendations

1. **Test the resolver with known users:** admin → sees admin tools; viewer → doesn't.
2. **Test FAIL_CLOSED:** empty sub, null response, throwing resolver → all return FAIL_CLOSED.
3. **Test the manifest directly:** call `tools/list` with different user tokens and assert the tool names.
4. **Test role changes:** change a user's role in the DB, start a new session, verify the manifest changed.
5. **Negative tests:** attempt to call an admin tool with a viewer token (should get "unknown tool" not 403 — the tool literally doesn't exist in their session).
