/**
 * @eidos-agi/rbtc — Role-Based Tool Control for MCP servers.
 *
 * Gate tool visibility in the MCP manifest based on the authenticated
 * caller's role. The AI model never sees tools the user can't call.
 *
 * Usage:
 *   import { createRbtc } from "@eidos-agi/rbtc";
 *
 *   const rbtc = createRbtc({
 *     roles: ["owner", "superadmin"],
 *     adminRoles: ["owner", "superadmin", "admin"],
 *   });
 *
 *   // Only registers if caller has an admin role
 *   rbtc.admin("delete_user", config, handler);
 *
 *   // Only registers if caller has one of the specified roles
 *   rbtc.ifRole(["cfo", "owner"], "export_payroll", config, handler);
 *
 *   // Always registers
 *   rbtc.everyone("get_revenue", config, handler);
 */

export { createRbtc, type RbtcConfig, type RbtcInstance } from "./rbtc.js";
export {
	resolveRoles,
	type RoleResolver,
	type ResolvedRoles,
	type RoleLookupResult,
} from "./resolver.js";
export { FAIL_CLOSED } from "./constants.js";
