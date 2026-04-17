/**
 * Example: Complete Cloudflare Worker with RBTC.
 *
 * Shows the full lifecycle: JWT validation → role resolution →
 * per-caller tool registration → MCP handler creation.
 *
 * Simplified version of the production pattern that originated RBTC.
 *
 * Key architectural decision: buildServer is ASYNC and takes the
 * authenticated user's props. It awaits role resolution BEFORE
 * registering any tools. By the time McpServer.tools/list is called,
 * the manifest is already tailored.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import { resolveRoles, createRbtc } from "@eidos-agi/rbtc";
import { createSupabaseResolver } from "./supabase-resolver.js";

interface Env {
	SUPABASE_URL: string;
	SUPABASE_ANON_KEY: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
}

interface AuthProps {
	sub: string;
	email?: string;
	jwt: string;
}

// ── Server builder (called per-request, after auth) ──────────

async function buildServer(env: Env, props: AuthProps): Promise<McpServer> {
	const server = new McpServer({ name: "my-mcp", version: "1.0" });

	// Resolve role from DB — single source of truth
	const resolver = createSupabaseResolver(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const roles = await resolveRoles(props.sub, resolver, ["owner", "superadmin", "admin"]);

	// Create RBTC instance — wraps register with role-gated helpers
	const rbtc = createRbtc({
		roles,
		register: (name, config, handler) => {
			// Your telemetry/instrumentation wrapper goes here
			(server.registerTool as any)(name, config, handler);
		},
		adminRoles: ["owner", "superadmin", "admin"],
	});

	// ── Business tools (everyone) ──────────────────────

	rbtc.everyone(
		"get_revenue",
		{
			title: "Get revenue for a period",
			description: "Returns revenue data scoped to the caller's entity access.",
			inputSchema: { period: z.string().regex(/^\d{4}-\d{2}$/) },
		},
		async ({ period }) => ({
			content: [{ type: "text", text: JSON.stringify({ period, revenue: 872850 }) }],
		}),
	);

	rbtc.everyone(
		"list_metrics",
		{
			title: "List all tracked KPIs",
			description: "Returns the metric registry — names, categories, statuses.",
		},
		async () => ({
			content: [{ type: "text", text: JSON.stringify({ count: 44 }) }],
		}),
	);

	// ── CFO tools ──────────────────────────────────────

	rbtc.ifRole(
		["cfo"],
		"export_payroll",
		{
			title: "Export payroll data (CFO only)",
			description: "Full payroll export for the specified period.",
			inputSchema: { period: z.string() },
		},
		async ({ period }) => ({
			content: [{ type: "text", text: JSON.stringify({ period, rows: 150 }) }],
		}),
	);

	// ── Admin tools ────────────────────────────────────

	rbtc.admin(
		"telemetry_query",
		{
			title: "Query telemetry events (admin only)",
			description: "Search the event stream. Admin scope sees all users.",
			inputSchema: { since: z.string().optional(), limit: z.number().optional() },
		},
		async ({ since, limit }) => ({
			content: [{ type: "text", text: JSON.stringify({ events: [], count: 0 }) }],
		}),
	);

	rbtc.admin(
		"delete_user",
		{
			title: "Soft-delete a user account (admin only)",
			description: "Sets deleted_at on the user_roles row. Irreversible via this tool.",
			inputSchema: { user_id: z.string().uuid() },
		},
		async ({ user_id }) => ({
			content: [{ type: "text", text: JSON.stringify({ deleted: user_id }) }],
		}),
	);

	// ── Predicate-gated (advanced) ─────────────────────

	rbtc.ifPredicate(
		(r) => r.entities.includes("*") || r.entities.length > 1,
		"compare_entities",
		{
			title: "Cross-entity comparison (multi-entity users only)",
			description: "Compare metrics across business units. Only visible to users with multi-entity access.",
			inputSchema: { metric_id: z.string(), period: z.string() },
		},
		async ({ metric_id, period }) => ({
			content: [{ type: "text", text: JSON.stringify({ metric_id, period }) }],
		}),
	);

	return server;
}

// ── Worker entry point ────────────────────────────────────────

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// 1. Validate JWT (your auth code here)
		const props = await validateBearer(request, env);
		if (!props) {
			return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
		}

		// 2. Build per-caller MCP server (RBTC happens inside)
		const mcpServer = await buildServer(env, props);

		// 3. Create handler + dispatch
		const handler = createMcpHandler(mcpServer, {
			authContext: { props },
			enableJsonResponse: true,
		});
		return handler(request, env, ctx);
	},
};

// Placeholder — replace with your real JWT validation
async function validateBearer(_request: Request, _env: Env): Promise<AuthProps | null> {
	return { sub: "user-id", email: "user@example.com", jwt: "..." };
}
