/**
 * Example: Supabase role resolver for RBTC.
 *
 * Reads the caller's role from a `user_roles` table using the
 * service-role key. This is the same table the dashboard reads
 * from — single source of truth.
 *
 * Table schema:
 *   CREATE TABLE user_roles (
 *     user_id    uuid REFERENCES auth.users(id) PRIMARY KEY,
 *     role       text NOT NULL DEFAULT 'viewer',
 *     entities   text[] DEFAULT '{}',
 *     deleted_at timestamptz,
 *     CHECK (role IN ('owner','superadmin','admin','cfo','cro','gm','manager','viewer'))
 *   );
 *   ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
 *
 * The service-role key bypasses RLS — that's intentional. We're
 * reading the CALLER's own role to decide what tools they see,
 * not accessing other users' data.
 */

import { createClient } from "@supabase/supabase-js";
import type { RoleResolver } from "@eidos-agi/rbtc";

export function createSupabaseResolver(
	supabaseUrl: string,
	serviceRoleKey: string,
): RoleResolver {
	const client = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	return async (sub: string) => {
		const { data, error } = await client
			.from("user_roles")
			.select("role, entities")
			.eq("user_id", sub)
			.is("deleted_at", null)
			.maybeSingle();

		if (error || !data) return null;

		return {
			role: data.role,
			entities: data.entities ?? [],
			metadata: { source: "supabase:user_roles" },
		};
	};
}

// Usage:
//
//   import { resolveRoles, createRbtc } from "@eidos-agi/rbtc";
//   import { createSupabaseResolver } from "./supabase-resolver.js";
//
//   const resolver = createSupabaseResolver(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
//   const roles = await resolveRoles(props.sub, resolver, ["owner", "superadmin", "admin"]);
//   const rbtc = createRbtc({ roles, register });
//
//   rbtc.everyone("list_metrics", config, handler);
//   rbtc.admin("telemetry_query", config, handler);
//   rbtc.ifRole(["cfo"], "export_payroll", config, handler);
