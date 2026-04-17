# What Claude Actually Sees: With and Without RBTC

The best way to understand RBTC is to see the same conversation from two users' perspectives. Same question, same MCP server, different manifests.

## Scenario: "What can you do with the dashboard project?"

### Without RBTC (everyone sees everything)

**User: Robert (General Manager)**

> **Robert:** What the dashboard project tools do you have?
>
> **Claude:** I have access to these the dashboard project tools:
> - `get_revenue` — revenue by entity and period
> - `list_metrics` — all tracked KPIs
> - `export_payroll` — full payroll export
> - `delete_user` — soft-delete a user account
> - `telemetry_query` — query the event stream
> - `data_source_health` — check data pipe status
>
> **Robert:** Export the payroll for March.
>
> **Claude:** I'll call `export_payroll` for March.
> *[calls export_payroll({period: "2026-03"})]*
>
> **Error: Forbidden — insufficient permissions**
>
> **Claude:** I'm sorry, it looks like you don't have permission to export payroll data. This tool may require CFO-level access. Would you like me to try something else?

Robert sees tools he can't use. Claude proposes them. The call fails. Claude apologizes. Robert wonders why the tool was offered in the first place.

### With RBTC (manifest tailored to Robert's role)

**User: Robert (General Manager, role: "gm")**

> **Robert:** What the dashboard project tools do you have?
>
> **Claude:** I have access to these the dashboard project tools:
> - `get_revenue` — revenue by entity and period
> - `list_metrics` — all tracked KPIs
> - `operations_health` — operational health and status
>
> **Robert:** Export the payroll for March.
>
> **Claude:** I don't have a payroll export tool available. I can help you with revenue data, metrics, or operations_health. For payroll access, you'd need to contact your admin.

Robert never sees `export_payroll`. Claude doesn't propose it. No failed call. No apology. Clean redirect.

---

## Scenario: "Check the system health"

### Alex (CFO, role: "cfo")

> **Alex:** Is everything working?
>
> **Claude:** I can check the metrics registry for you. Let me call `registry_health`.
> *[calls registry_health()]*
>
> 44 metrics tracked, 9 live, 21 pending. Coverage: calculation 100%, goldColumn 14%. Three live metrics need goldColumn for direct querying.
>
> **Alex:** What about the data pipes?
>
> **Claude:** I don't have a data source health tool available — that's an admin-level diagnostic. I can check metric freshness by querying the latest period in the revenue data. Want me to try that?

Alex sees business tools + CFO tools. She doesn't see `data_source_health` (admin-gated). Claude works within her actual capabilities without pretending admin tools exist.

### Daniel (Admin, role: "superadmin")

> **Daniel:** Is everything working?
>
> **Claude:** Let me check both the registry and the data sources.
> *[calls registry_health()]*
> *[calls data_source_health()]*
>
> **Registry:** 44 metrics, 9 live, coverage looks good.
> **Data sources:**
> - sage_gold: OK, latest period 2026-03, 3 entities
> - telemetry: OK, 2,147 events, queue clear
> - Supabase auth: OK, v2.188.1
>
> All systems healthy.

Daniel sees everything — business tools + admin tools. Claude uses both in a single turn without the user having to ask for the admin-specific check. The tools were in the manifest, so Claude knew they were available.

---

## Scenario: "What's Region A revenue?"

### Viewer (entities: ["consolidated"])

> **User:** What's Region A revenue for December?
>
> **Claude:** Let me check. *[calls query_metric({metric_id: "MTR-REV-002", period: "2025-12"})]*
>
> Region A revenue for a recent period was $XX,XXX.

The tool works — the viewer can query Region A data because the metric is public. But notice: if **scope narrowing** is applied, the tool's input schema might lock this user to `entity: "consolidated"` only, and Claude would say:

> **Claude:** I can only query consolidated revenue with your access level. Consolidated December revenue was $XXX,XXX. For entity-specific breakdowns, contact your admin.

Same tool, different schema, different behavior — driven by the `entities` field in the resolved role.

---

## What the AI's reasoning looks like

Without RBTC, Claude's internal reasoning includes:

```
Available tools: get_revenue, list_metrics, export_payroll, delete_user, telemetry_query, ...
The user asked about payroll → export_payroll seems relevant → I'll try it
```

With RBTC (for a viewer):

```
Available tools: get_revenue, list_metrics
The user asked about payroll → I don't have a payroll tool → I'll explain what I can do instead
```

The AI's reasoning is bounded by the manifest. It can't hallucinate tools it hasn't seen. It can't "try" a tool that doesn't exist in its context. The boundary is at the thinking layer, not the execution layer.

---

## The key difference

| | Without RBTC | With RBTC |
|---|---|---|
| **Claude's tool list** | All tools, all users | Tailored per-caller |
| **Unauthorized tool calls** | Happen, then fail | Can't happen |
| **User experience on denial** | "Error: Forbidden" + apology | "I don't have that tool" + redirect |
| **Claude's reasoning quality** | Polluted by tools user can't use | Focused on actual capabilities |
| **Trust signal** | Inconsistent (offers then retracts) | Consistent (only offers what works) |
