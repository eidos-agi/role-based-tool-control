#!/usr/bin/env npx tsx
/**
 * Minimal RBTC demo — run with: npx tsx examples/minimal-demo.ts
 *
 * Shows how different users get different tool manifests
 * from the same server. No database, no auth provider —
 * just the core pattern in 40 lines.
 */

import { resolveRoles, createRbtc, FAIL_CLOSED } from "../src/index.js";
import type { RoleResolver } from "../src/resolver.js";

// Simulated user database — in production, this queries your DB
const resolver: RoleResolver = async (sub) => {
	const users: Record<string, { role: string; entities?: string[] }> = {
		alice: { role: "admin", entities: ["*"] },
		bob: { role: "cfo", entities: ["finance"] },
		carol: { role: "viewer", entities: ["public"] },
	};
	return users[sub] ? { role: users[sub].role, entities: users[sub].entities } : null;
};

// Simulate building a server for each user
async function showManifest(userName: string) {
	const roles = await resolveRoles(userName, resolver, ["admin", "superadmin"]);
	const tools: string[] = [];

	const rbtc = createRbtc({
		roles,
		register: (name) => tools.push(name),
		adminRoles: ["admin", "superadmin"],
	});

	// Register tools with different visibility
	rbtc.everyone("get_revenue", {}, async () => ({}));
	rbtc.everyone("list_metrics", {}, async () => ({}));
	rbtc.admin("delete_user", {}, async () => ({}));
	rbtc.admin("view_audit_log", {}, async () => ({}));
	rbtc.ifRole(["cfo"], "export_payroll", {}, async () => ({}));
	rbtc.ifRole(["cfo"], "gl_drilldown", {}, async () => ({}));
	rbtc.ifPredicate(
		(r) => r.entities.includes("*"),
		"cross_entity_compare", {}, async () => ({}),
	);

	console.log(`\n${userName} (${roles.roleId || "no role"}):`);
	console.log(`  tools: [${tools.join(", ")}]`);
	console.log(`  admin: ${roles.admin}`);
	console.log(`  count: ${tools.length}`);
}

// Run for all users + an unknown user
console.log("=== RBTC Demo: Same server, different manifests ===");
await showManifest("alice");   // admin  → sees all 7 tools
await showManifest("bob");     // cfo    → sees 4 tools (2 everyone + 2 cfo)
await showManifest("carol");   // viewer → sees 2 tools (everyone only)
await showManifest("nobody");  // unknown → FAIL_CLOSED, sees 2 tools
console.log("\n=== The AI can only propose tools the user can call. ===\n");
