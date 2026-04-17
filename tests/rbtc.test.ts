/**
 * RBTC unit tests. Run: npx tsx tests/rbtc.test.ts
 */

import { resolveRoles, FAIL_CLOSED } from "../src/index.js";
import { createRbtc, type RegisterFn } from "../src/rbtc.js";
import type { ResolvedRoles, RoleResolver } from "../src/resolver.js";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
	if (condition) { passed++; console.log(`  ✓ ${label}`); }
	else { failed++; console.log(`  ✗ ${label}`); }
}

// ── resolveRoles ──────────────────────────────────────────────

console.log("\n── resolveRoles ──");

const mockResolver: RoleResolver = async (sub) => {
	const users: Record<string, { role: string; entities?: string[] }> = {
		"admin-1": { role: "superadmin", entities: ["*"] },
		"cfo-1": { role: "cfo", entities: ["region_a", "region_b"] },
		"multi-1": { role: "viewer,cfo", entities: ["region_a"] },
		"viewer-1": { role: "viewer", entities: ["consolidated"] },
		"empty-role": { role: "" },
	};
	return users[sub] ?? null;
};

const adminRoles = ["owner", "superadmin", "admin"] as const;

const r1 = await resolveRoles("admin-1", mockResolver, adminRoles);
assert("superadmin → admin=true", r1.admin === true);
assert("superadmin → roles=[superadmin]", r1.roles.length === 1 && r1.roles[0] === "superadmin");
assert("superadmin → entities=[*]", r1.entities[0] === "*");

const r2 = await resolveRoles("cfo-1", mockResolver, adminRoles);
assert("cfo → admin=false", r2.admin === false);
assert("cfo → roles=[cfo]", r2.roles[0] === "cfo");
assert("cfo → entities has region_a", r2.entities.includes("region_a"));

const r3 = await resolveRoles("multi-1", mockResolver, adminRoles);
assert("multi → roles=[viewer,cfo]", r3.roles.length === 2);
assert("multi → admin=false", r3.admin === false);

const r4 = await resolveRoles("viewer-1", mockResolver, adminRoles);
assert("viewer → admin=false", r4.admin === false);

const r5 = await resolveRoles("nonexistent", mockResolver, adminRoles);
assert("unknown user → FAIL_CLOSED", r5.admin === false && r5.roles.length === 0);

const r6 = await resolveRoles("", mockResolver, adminRoles);
assert("empty sub → FAIL_CLOSED", r6.admin === false && r6.roles.length === 0);

const r7 = await resolveRoles("empty-role", mockResolver, adminRoles);
assert("empty role string → FAIL_CLOSED", r7.roles.length === 0);

const throwResolver: RoleResolver = async () => { throw new Error("DB down"); };
const r8 = await resolveRoles("any", throwResolver, adminRoles);
assert("throwing resolver → FAIL_CLOSED", r8.admin === false && r8.roles.length === 0);

// ── FAIL_CLOSED ───────────────────────────────────────────────

console.log("\n── FAIL_CLOSED ──");

assert("FAIL_CLOSED.admin = false", FAIL_CLOSED.admin === false);
assert("FAIL_CLOSED.roles = []", FAIL_CLOSED.roles.length === 0);
assert("FAIL_CLOSED.entities = []", FAIL_CLOSED.entities.length === 0);
assert("FAIL_CLOSED is frozen", Object.isFrozen(FAIL_CLOSED));

// ── createRbtc ────────────────────────────────────────────────

console.log("\n── createRbtc ──");

function testRbtc(roles: ResolvedRoles): string[] {
	const registered: string[] = [];
	const register: RegisterFn = (name) => { registered.push(name); };

	const rbtc = createRbtc({
		roles,
		register,
		adminRoles: ["owner", "superadmin", "admin"],
	});

	rbtc.everyone("get_revenue", {}, async () => ({}));
	rbtc.everyone("list_metrics", {}, async () => ({}));
	rbtc.admin("delete_user", {}, async () => ({}));
	rbtc.admin("telemetry_query", {}, async () => ({}));
	rbtc.ifRole(["cfo"], "export_payroll", {}, async () => ({}));
	rbtc.ifRole(["gm"], "fleet_health", {}, async () => ({}));
	rbtc.ifPredicate(
		(r) => r.entities.includes("*"),
		"compare_entities", {}, async () => ({}),
	);

	return registered;
}

const adminTools = testRbtc({
	roleId: "superadmin", roles: ["superadmin"], admin: true, entities: ["*"], metadata: {},
});
assert("admin sees all 7 tools", adminTools.length === 7);
assert("admin sees delete_user", adminTools.includes("delete_user"));
assert("admin sees export_payroll", adminTools.includes("export_payroll"));
assert("admin sees compare_entities (wildcard)", adminTools.includes("compare_entities"));

const cfoTools = testRbtc({
	roleId: "cfo", roles: ["cfo"], admin: false, entities: ["region_a"], metadata: {},
});
assert("cfo sees 3 tools (2 everyone + 1 cfo)", cfoTools.length === 3);
assert("cfo sees export_payroll", cfoTools.includes("export_payroll"));
assert("cfo does NOT see delete_user", !cfoTools.includes("delete_user"));
assert("cfo does NOT see fleet_health", !cfoTools.includes("fleet_health"));
assert("cfo does NOT see compare_entities (no wildcard)", !cfoTools.includes("compare_entities"));

const viewerTools = testRbtc({
	roleId: "viewer", roles: ["viewer"], admin: false, entities: ["consolidated"], metadata: {},
});
assert("viewer sees 2 tools (everyone only)", viewerTools.length === 2);
assert("viewer sees get_revenue", viewerTools.includes("get_revenue"));
assert("viewer does NOT see delete_user", !viewerTools.includes("delete_user"));
assert("viewer does NOT see export_payroll", !viewerTools.includes("export_payroll"));

const noRoleTools = testRbtc(FAIL_CLOSED);
assert("FAIL_CLOSED sees 2 tools (everyone only)", noRoleTools.length === 2);

const gmTools = testRbtc({
	roleId: "gm", roles: ["gm"], admin: false, entities: ["region_a"], metadata: {},
});
assert("gm sees 3 tools (2 everyone + fleet_health)", gmTools.length === 3);
assert("gm sees fleet_health", gmTools.includes("fleet_health"));
assert("gm does NOT see export_payroll", !gmTools.includes("export_payroll"));

// ── Summary ───────────────────────────────────────────────────

console.log(`\n── Summary: ${passed} passed, ${failed} failed ──`);
process.exit(failed > 0 ? 1 : 0);
