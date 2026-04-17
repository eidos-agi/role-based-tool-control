# Case Study: RBTC with Supabase

Supabase is a natural fit for RBTC because it gives you three things out of the box: JWT-based auth, a Postgres database for the role store, and Row-Level Security as the data-layer complement.

## Architecture

```
User → Claude.ai → MCP Worker → Supabase
                                    ├─ auth.users (identity — JWT sub)
                                    ├─ user_roles (authorization — role, entities)
                                    └─ business tables (data — RLS-gated)
```

The JWT carries identity (`sub`). The `user_roles` table carries authorization. RBTC reads the latter to build the manifest; RLS reads the former to gate data. Belt and suspenders.

## Why Supabase for the role store?

### The dashboard already uses it

If your app has a dashboard (Next.js, SvelteKit, whatever) that reads `user_roles` to decide which sidebar items to show, your MCP server should read the same table. One source of truth. When you change Alex from "viewer" to "cfo" in the dashboard admin panel, her MCP tool surface changes on her next connection — no separate sync, no JWT refresh, no manual step.

### Service-role key gives admin access

Supabase's service-role key bypasses RLS. This is exactly what RBTC needs: the MCP server reads ANY user's role row to build THEIR manifest. The caller's own JWT can't read other users' roles (RLS prevents it), but the server's service-role key can read the one row it needs.

```typescript
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data } = await admin
  .from("user_roles")
  .select("role, entities")
  .eq("user_id", callerSub)
  .is("deleted_at", null)
  .maybeSingle();
```

### RLS is the second layer

RBTC prevents the AI from *proposing* unauthorized operations. RLS prevents the *database* from *executing* them if something slips through. Both matter:

- RBTC alone: AI never proposes `export_payroll` to a viewer. But if a bug registers the tool anyway, the database still blocks the query.
- RLS alone: AI proposes `export_payroll` to a viewer, gets a 403, apologizes, wastes a turn. Functional but ugly.
- RBTC + RLS: AI never proposes it AND the database wouldn't allow it. Clean UX + defense in depth.

## Design decisions

### Query per-session, not per-tool-call

`resolveCallerRole` runs once when the MCP session is established (on `tools/list`). It does NOT run on every tool call. This means:

- One DB round-trip per connection, not per turn
- Role changes take effect on next connection, not mid-conversation
- If the DB is slow, only the initial connection feels it

### Fail closed, not fail open

If the role query fails (DB down, user has no row, network timeout), RBTC returns `FAIL_CLOSED` — an empty roles object with `admin: false`. Business tools still register (they don't check roles). Admin/CFO/GM tools silently disappear. The user gets a degraded but safe experience.

### Comma-separated multi-role

Some systems assign multiple roles: `"viewer,cfo"`. The resolver splits on commas, trims whitespace, and checks membership on the parsed array. A user with `"viewer,cfo"` sees both viewer-visible and CFO-visible tools.

## Migration path: JWT claims → DB lookup

Many Supabase apps start by putting roles in `app_metadata`:

```sql
UPDATE auth.users SET raw_app_meta_data =
  jsonb_set(raw_app_meta_data, '{role}', '"cfo"')
WHERE id = '...';
```

This works but drifts — the JWT carries whatever was true at login time. If you change the role, the user needs a new token (logout + login, or token refresh).

RBTC's DB-lookup approach avoids this entirely. But if you later want the JWT to carry role info (for performance — skip the DB lookup), Supabase supports auth hooks:

```sql
CREATE FUNCTION auth.custom_jwt_claims(event jsonb) RETURNS jsonb AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.user_roles
  WHERE user_id = (event->'claims'->>'sub')::uuid
    AND deleted_at IS NULL;
  IF user_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(user_role));
  END IF;
  RETURN event;
END;
$$ LANGUAGE plpgsql STABLE;
```

Register the hook in Supabase Dashboard → Auth → Hooks → `before_token_issued`. Then your resolver can fast-path from JWT claims and fall back to DB on miss.

## Table schema recommendation

```sql
CREATE TABLE user_roles (
  user_id    uuid REFERENCES auth.users(id) PRIMARY KEY,
  role       text NOT NULL DEFAULT 'viewer',
  entities   text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT valid_role CHECK (role ~ '^[a-z_,]+$')
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role (for the dashboard sidebar)
CREATE POLICY users_read_own ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can read any row (for RBTC resolution)
-- (Implicit — service role bypasses RLS)

-- Soft deletes only
CREATE INDEX idx_active_roles ON user_roles(user_id) WHERE deleted_at IS NULL;
```
