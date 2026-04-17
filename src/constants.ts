import type { ResolvedRoles } from "./resolver.js";

/**
 * The safe default when role resolution fails. No roles, no admin,
 * no entities. Business tools still work (they don't check this);
 * role-gated tools silently disappear.
 */
export const FAIL_CLOSED: ResolvedRoles = Object.freeze({
	roleId: "",
	roles: [],
	admin: false,
	entities: [],
	metadata: {},
});
