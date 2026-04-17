/**
 * Role resolution — the bridge between "who is calling?" and
 * "what should they see?"
 *
 * RBTC is auth-provider agnostic. You bring a RoleResolver function;
 * we call it at session init and use the result to gate tools.
 *
 * Built-in resolvers for common stacks are in examples/.
 */

import { FAIL_CLOSED } from "./constants.js";

export interface ResolvedRoles {
	/** Raw role string from the source (may be comma-separated). */
	roleId: string;
	/** Parsed individual role IDs. */
	roles: string[];
	/** True if any role is in the configured admin set. */
	admin: boolean;
	/** Data-scoping tokens (e.g., business units, regions, teams). */
	entities: string[];
	/** Arbitrary key-value pairs from the role source. */
	metadata: Record<string, unknown>;
}

export interface RoleLookupResult {
	/** The role string (e.g., "cfo" or "viewer,cfo"). */
	role: string | null;
	/** Data scope tokens. */
	entities?: string[];
	/** Any additional metadata to carry through. */
	metadata?: Record<string, unknown>;
}

/**
 * A function that takes a user identifier and returns their role.
 * Implement this for your auth provider.
 *
 * Return null to trigger FAIL_CLOSED (no role-gated tools visible).
 */
export type RoleResolver = (
	sub: string,
) => Promise<RoleLookupResult | null>;

/**
 * Resolve a caller's roles using a custom resolver.
 *
 * @param sub - The caller's unique identifier (JWT sub claim, user ID, etc.)
 * @param resolver - Your auth-provider-specific resolver function
 * @param adminRoles - Which role IDs count as "admin" for the admin() helper
 * @returns ResolvedRoles — always returns a value, never throws
 */
export async function resolveRoles(
	sub: string,
	resolver: RoleResolver,
	adminRoles: readonly string[] = ["admin"],
): Promise<ResolvedRoles> {
	if (!sub) return FAIL_CLOSED;

	try {
		const result = await resolver(sub);
		if (!result || !result.role) return FAIL_CLOSED;

		const roleId = result.role.trim();
		const roles = roleId
			.split(",")
			.map((r) => r.trim())
			.filter(Boolean);

		return {
			roleId,
			roles,
			admin: roles.some((r) => (adminRoles as readonly string[]).includes(r)),
			entities: Array.isArray(result.entities) ? result.entities : [],
			metadata: result.metadata ?? {},
		};
	} catch {
		return FAIL_CLOSED;
	}
}
