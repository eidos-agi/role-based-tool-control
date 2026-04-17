# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in RBTC, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email security@eidosagi.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment
3. You will receive a response within 48 hours
4. A fix will be prioritized based on severity

## Security Model

RBTC operates at the **manifest layer** — between the AI model and tool handlers. It is one layer in a defense-in-depth stack:

```
Layer 1: OAuth scopes     → what the user consented to
Layer 2: RBTC             → what tools the user should see
Layer 3: Handler checks   → is this specific call allowed?
Layer 4: Database RLS     → can this user read this row?
```

RBTC's security guarantees:

- **FAIL_CLOSED**: If role resolution fails (DB down, missing user, error), zero role-gated tools are registered. Business tools still work; admin tools silently disappear.
- **Manifest-level gating**: Unauthorized tools are never sent to the AI model. The model cannot propose, reason about, or attempt to call tools that aren't in its manifest.
- **No execution-time bypass**: Tools that aren't registered cannot be called, regardless of how the request is crafted.

RBTC does **not** provide:

- Authentication (bring your own JWT validation)
- Network security (bring your own TLS, rate limiting)
- Database access control (bring your own RLS)
- Prompt injection defense (orthogonal concern)

For the full threat model, see [docs/security-model.md](docs/security-model.md).
