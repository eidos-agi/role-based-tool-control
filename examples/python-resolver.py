"""
Example: RBTC in a Python MCP server.

The pattern is language-agnostic. This shows the same concept using
the official mcp Python package + any SQL database for role lookup.

Run: pip install mcp psycopg2-binary
"""

import os
from dataclasses import dataclass, field
from typing import Callable

from mcp.server import Server
from mcp.types import Tool, TextContent

ADMIN_ROLES = {"owner", "superadmin", "admin"}


@dataclass
class ResolvedRoles:
    role_id: str = ""
    roles: list[str] = field(default_factory=list)
    admin: bool = False
    entities: list[str] = field(default_factory=list)


FAIL_CLOSED = ResolvedRoles()


def resolve_caller_role(user_id: str, db_url: str) -> ResolvedRoles:
    """Query the user_roles table for the caller's role. Fail closed."""
    if not user_id or not db_url:
        return FAIL_CLOSED
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(
            "SELECT role, entities FROM user_roles WHERE user_id = %s AND deleted_at IS NULL LIMIT 1",
            (user_id,),
        )
        row = cur.fetchone()
        conn.close()
        if not row or not row[0]:
            return FAIL_CLOSED
        roles = [r.strip() for r in row[0].split(",") if r.strip()]
        return ResolvedRoles(
            role_id=row[0],
            roles=roles,
            admin=bool(ADMIN_ROLES & set(roles)),
            entities=row[1] or [],
        )
    except Exception:
        return FAIL_CLOSED


class RbtcServer:
    """Wraps mcp.Server with role-gated tool registration."""

    def __init__(self, server: Server, roles: ResolvedRoles):
        self.server = server
        self.roles = roles
        self._tools: dict[str, Callable] = {}

    def everyone(self, name: str, description: str):
        """Decorator: register a tool visible to all authenticated users."""
        def decorator(fn):
            self._tools[name] = fn
            return fn
        return decorator

    def admin(self, name: str, description: str):
        """Decorator: register a tool visible only to admin-tier roles."""
        def decorator(fn):
            if self.roles.admin:
                self._tools[name] = fn
            return fn
        return decorator

    def if_role(self, allowed: set[str], name: str, description: str):
        """Decorator: register a tool visible to specific roles + admins."""
        def decorator(fn):
            if (set(self.roles.roles) & (allowed | ADMIN_ROLES)):
                self._tools[name] = fn
            return fn
        return decorator


# ── Usage ──────────────────────────────────────────────────────

def build_server(user_id: str) -> Server:
    server = Server("my-mcp")
    roles = resolve_caller_role(user_id, os.environ.get("DATABASE_URL", ""))
    rbtc = RbtcServer(server, roles)

    @rbtc.everyone("get_revenue", "Get revenue for a period")
    async def get_revenue(period: str) -> list[TextContent]:
        return [TextContent(type="text", text=f"Revenue for {period}: $872,850")]

    @rbtc.admin("telemetry_query", "Query telemetry events (admin only)")
    async def telemetry_query(since: str = "") -> list[TextContent]:
        return [TextContent(type="text", text="Events: [...]")]

    @rbtc.if_role({"cfo"}, "export_payroll", "Export payroll data (CFO only)")
    async def export_payroll(period: str) -> list[TextContent]:
        return [TextContent(type="text", text=f"Payroll for {period}: 150 rows")]

    # Register tools on the server
    tools = []
    for name, fn in rbtc._tools.items():
        tools.append(Tool(name=name, description="", inputSchema={"type": "object"}))

    @server.list_tools()
    async def list_tools():
        return tools

    return server
