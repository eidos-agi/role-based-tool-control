/**
 * The RBTC instance — wraps your MCP server's register function
 * with role-gated helpers.
 *
 * Usage:
 *   const roles = await resolveRoles(sub, myResolver, ["admin", "owner"]);
 *   const rbtc = createRbtc({ roles, register: myRegisterFn });
 *
 *   rbtc.everyone("get_revenue", config, handler);
 *   rbtc.admin("delete_user", config, handler);
 *   rbtc.ifRole(["cfo"], "export_payroll", config, handler);
 */

import type { ResolvedRoles } from "./resolver.js";

/** The register function signature — matches the MCP SDK's registerTool shape. */
export type RegisterFn = (
	name: string,
	config: { title?: string; description?: string; inputSchema?: unknown },
	handler: (...args: unknown[]) => Promise<unknown>,
) => void;

export interface RbtcConfig {
	/** The caller's resolved roles. */
	roles: ResolvedRoles;
	/** Your MCP server's tool registration function. */
	register: RegisterFn;
	/** Which role IDs are considered admin-tier. Default: ["admin"]. */
	adminRoles?: readonly string[];
}

export interface RbtcInstance {
	/** The resolved roles this instance was built with. */
	readonly roles: ResolvedRoles;

	/** Register a tool visible to everyone (no role gate). */
	everyone: RegisterFn;

	/** Register a tool visible only to admin-tier roles. */
	admin: RegisterFn;

	/**
	 * Register a tool visible only to callers with at least one of the
	 * specified roles. Admin-tier roles always pass.
	 */
	ifRole: (allowed: string[], ...args: Parameters<RegisterFn>) => void;

	/**
	 * Register a tool visible only when the predicate returns true.
	 * Most flexible gate — use for consent-aware, usage-based, or
	 * delegation-based gating.
	 */
	ifPredicate: (
		predicate: (roles: ResolvedRoles) => boolean,
		...args: Parameters<RegisterFn>
	) => void;
}

export function createRbtc(config: RbtcConfig): RbtcInstance {
	const { roles, register } = config;
	const adminSet = new Set(config.adminRoles ?? ["admin"]);

	const isAdmin = roles.roles.some((r) => adminSet.has(r));

	return {
		roles,

		everyone: (name, cfg, handler) => {
			register(name, cfg, handler);
		},

		admin: (name, cfg, handler) => {
			if (isAdmin) register(name, cfg, handler);
		},

		ifRole: (allowed, name, cfg, handler) => {
			const allowedSet = new Set([...allowed, ...adminSet]);
			if (roles.roles.some((r) => allowedSet.has(r))) {
				register(name, cfg, handler);
			}
		},

		ifPredicate: (predicate, name, cfg, handler) => {
			if (predicate(roles)) {
				register(name, cfg, handler);
			}
		},
	};
}
