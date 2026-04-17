/**
 * Example: RBTC with a Node.js/Express MCP server.
 *
 * Most MCP servers run on Node.js, not Cloudflare Workers. This shows
 * the same RBTC pattern in a standard Express app using the MCP SDK's
 * StreamableHTTPServerTransport.
 *
 * Key difference from Workers: Express is long-running, so you can't
 * rebuild the McpServer per-request as easily. Instead, we create a
 * fresh server instance per SSE connection (each client gets its own
 * session with its own manifest).
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { resolveRoles, createRbtc } from "@eidos-agi/rbtc";
import type { RoleResolver } from "@eidos-agi/rbtc";

const app = express();
app.use(express.json());

// ── Your role resolver ────────────────────────────────────────

const resolver: RoleResolver = async (sub) => {
	// Replace with your actual DB query
	const roles: Record<string, { role: string; entities: string[] }> = {
		"user-admin": { role: "admin", entities: ["*"] },
		"user-cfo": { role: "cfo", entities: ["region_a", "region_b"] },
		"user-viewer": { role: "viewer", entities: ["consolidated"] },
	};
	const match = roles[sub];
	return match ? { role: match.role, entities: match.entities } : null;
};

// ── Build a per-session MCP server ────────────────────────────

async function buildServer(callerSub: string): Promise<McpServer> {
	const server = new McpServer({ name: "my-express-mcp", version: "1.0" });

	const roles = await resolveRoles(callerSub, resolver, [
		"admin",
		"superadmin",
		"owner",
	]);

	const rbtc = createRbtc({
		roles,
		register: (name, config, handler) => {
			(server as any).registerTool(name, config, handler);
		},
		adminRoles: ["admin", "superadmin", "owner"],
	});

	// Everyone
	rbtc.everyone(
		"get_data",
		{
			title: "Get business data",
			description: "Returns data scoped to your entity access.",
			inputSchema: { query: z.string() },
		},
		async ({ query }) => ({
			content: [{ type: "text" as const, text: `Results for: ${query}` }],
		}),
	);

	// Admin only
	rbtc.admin(
		"manage_users",
		{
			title: "Manage user accounts (admin only)",
			description: "List, create, or deactivate user accounts.",
			inputSchema: { action: z.enum(["list", "create", "deactivate"]) },
		},
		async ({ action }) => ({
			content: [
				{ type: "text" as const, text: `User management: ${action}` },
			],
		}),
	);

	// CFO only
	rbtc.ifRole(
		["cfo"],
		"financial_export",
		{
			title: "Export financial data (CFO only)",
			description: "Full GL export for a fiscal period.",
			inputSchema: { period: z.string() },
		},
		async ({ period }) => ({
			content: [
				{ type: "text" as const, text: `Financial export for ${period}` },
			],
		}),
	);

	return server;
}

// ── Express routes ────────────────────────────────────────────

// Extract caller identity from your auth middleware
function getCallerSub(req: express.Request): string | null {
	// Replace with your JWT validation
	const auth = req.headers.authorization;
	if (!auth?.startsWith("Bearer ")) return null;
	// Decode JWT, extract sub... simplified here:
	return req.headers["x-user-id"] as string ?? null;
}

app.post("/mcp", async (req, res) => {
	const sub = getCallerSub(req);
	if (!sub) {
		res.status(401).json({ error: "unauthorized" });
		return;
	}

	// Build a RBTC-gated server for THIS caller
	const server = await buildServer(sub);

	// Create transport and handle the request
	const transport = new StreamableHTTPServerTransport("/mcp", res);
	await server.connect(transport);

	// The transport handles the response lifecycle
});

// ── Start ─────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
	console.log(`MCP server with RBTC listening on port ${PORT}`);
	console.log(`  Admin user:  curl -H "x-user-id: user-admin" ...`);
	console.log(`  CFO user:    curl -H "x-user-id: user-cfo" ...`);
	console.log(`  Viewer user: curl -H "x-user-id: user-viewer" ...`);
});
