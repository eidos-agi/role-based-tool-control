# Backstory: From Complex Problems to Simple Answers

## The Real Problem

A mid-market company operates across multiple business units, each with different revenue profiles, cost structures, and operational needs. The data lives in an ERP system, an operations platform, an HR system, and half a dozen other tools.

The executive team has questions every Monday morning:

- *"What's our consolidated revenue this month, and how does the second business unit compare to last quarter?"*
- *"Are operating costs as a percentage of revenue trending up?"*
- *"How many field staff do we have active, and what are the labor costs?"*
- *"That new service line — is it profitable yet?"*

These are **complex questions about a multi-system business**. Answering them traditionally requires: log into the ERP, pull a report, export to Excel, cross-reference with the operations system, email it to the CFO, wait for questions, repeat. Every Monday. For every question.

The goal was never to build software. **The goal was to make these questions trivially easy to answer, for the right people, securely.**

## Why AI Changes the Equation

AI models like Claude can reason across structured data, synthesize narratives, spot anomalies, and answer follow-up questions — if they have access to the data. A CFO doesn't need a dashboard with 47 charts. She needs to ask *"what happened with revenue this month?"* and get a real answer in 30 seconds.

But the AI needs the data. And the data needs to be:

1. **Accessible** — the AI can query it, not just read a screenshot
2. **Structured** — revenue by entity by period, not a PDF of a spreadsheet
3. **Fresh** — today's numbers, not last week's export
4. **Secure** — the CFO sees financial data; the GM sees operational data; a viewer sees the executive summary; nobody sees what they shouldn't

The first three are a data engineering problem (ETL pipeline, data warehouse, materialized views). The fourth is the access control problem — and it's where most AI deployments fail.

## The Chatbot Graveyard

Billions of dollars have been spent building AI interfaces that users hate — or that actively damage the company:

**Air Canada (2024):** Their chatbot promised a bereavement fare discount to a grieving customer. The policy didn't exist. The airline was forced to honor it in court. The AI was trained on marketing copy, not business rules, and had no concept of what actions were appropriate.

**DPD (2024):** The UK delivery company's chatbot was tricked into swearing at customers and calling DPD "the worst delivery firm in the world." No guardrails on what it could say, because it had no concept of role or context.

**McDonald's (2024):** Their drive-through AI was pulled after viral videos of it adding hundreds of dollars of food to orders. The system could propose any action because nothing scoped what actions were appropriate.

**Chevrolet (2023):** A dealer's chatbot was convinced to sell a Tahoe for $1 and to recommend Ford trucks. Full access to all responses, no scoping for what was appropriate.

**Chipotle's "Pepper" (2025):** Someone asked the Chipotle ordering chatbot for help writing a Python script to reverse a linked list — *before* ordering their bowl. The chatbot happily obliged, writing out a full `reverse_linked_list()` function with O(n) analysis, then asked "Can I help with anything else, or would you like to start with a burrito, bowl, or something else today?" A food-ordering AI that moonlights as a coding tutor — because it had no concept of what capabilities were appropriate in context.

![Chipotle's Pepper chatbot writing Python code instead of taking a food order](../images/chipotle-chatbot.jpg)

*Source: Reddit. Chipotle's chatbot had access to general AI capabilities with no scoping for its actual job.*

Every bank, airline, and telecom "how can I help you?" widget that loops through 5 canned responses before suggesting you call the 1-800 number.

**These aren't failures of AI capability. They're failures of tool architecture.** The AI had access to everything, guardrails on nothing, and the company's response was to either remove the AI or lobotomize it into a FAQ search. With RBTC, the Chipotle chatbot would have had exactly one category of tools: food ordering. No Python, no coding help, no off-topic capabilities — because those tools wouldn't exist in the manifest.

## How Claude.ai Enables This — But Needs Data Securely

Claude.ai supports the Model Context Protocol (MCP) — an open standard for connecting AI models to external tool servers. You register an MCP server as a connector, authorize via OAuth, and Claude can call your tools from any conversation.

This is the bridge: **Claude provides world-class reasoning. Your MCP server provides the data.** The combination turns "log into 5 systems and build a spreadsheet" into "ask Claude."

But Claude's MCP connector sees whatever tools the server exposes. If the server registers `export_payroll` and `delete_user` alongside `get_revenue`, Claude sees all of them — regardless of who's asking.

**RBTC closes this gap.** The MCP server builds a per-caller manifest: the CFO's Claude session sees financial tools. The GM's session sees operational tools. The admin sees everything. The viewer sees the basics. Same connector, same server, different tool surface — driven by the caller's identity.

Claude gets the data it needs to reason well. Each person gets exactly the tools they're authorized to use. The AI can't propose unauthorized actions because the tools don't exist in its context.

## What This Made Possible

With RBTC in place, the Monday morning workflow became:

**The CFO** opens Claude, asks: *"What's our revenue this month compared to last quarter?"*
Claude calls `query_metric` for consolidated revenue, current period and Q-1. Returns a formatted comparison. The CFO asks a follow-up: *"Break that down by entity."* Claude calls `get_metric_history` for each entity. Done. No dashboard, no Excel, no waiting.

**The GM** opens Claude, asks: *"How are operations looking?"*
Claude calls `operations_health` (an operations tool the CFO doesn't see). Returns maintenance status, operational efficiency, labor hours. The GM asks: *"Any assets overdue for maintenance?"* Claude drills in. No context switch, no separate login.

**The admin** opens Claude, asks: *"Are the data pipes healthy?"*
Claude calls `data_source_health` (an admin tool nobody else sees). Returns: data warehouse OK, telemetry OK, auth OK. Then asks: *"What did Claude do in the last hour?"* Claude calls `telemetry_query`. Full event stream. Ops visibility without a separate monitoring dashboard.

Each person got **the answer to their complex question** through a conversation — not a report, not a dashboard, not a spreadsheet. The AI had exactly the right tools for their role. Nothing more.

## 650 Lines vs 35,000

| | Custom chatbot approach | MCP + RBTC approach |
|---|---|---|
| Lines of code maintained | 15,000–35,000 | ~650 |
| Time to add a new role | Days (prompt re-engineering) | Minutes (one DB row) |
| Time to add a new tool | Hours (UI + guardrails) | Minutes (one register call) |
| Model upgrade cost | Weeks (re-tune + re-test) | Zero (tools unchanged, reasoning improves) |
| Security model | Guardrails (hope-based) | Manifest gating (architecture-based) |

## It Gets Smarter — Not Dumber

The most counterintuitive advantage: with a custom chatbot, every model upgrade is a regression risk. Your prompts were tuned for GPT-4. GPT-5 comes out and they behave differently. Every upgrade is a re-engineering cycle.

With MCP + RBTC, model upgrades are **free capability upgrades.** The same `get_revenue` tool gets called by a smarter model — which reasons better about the results, synthesizes more nuanced answers, and handles edge cases more gracefully. Your AI gets smarter without you changing a line of code.

```
Custom chatbot trajectory:
  Build → works → model changes → breaks → re-engineer → works → breaks
  Net direction: sideways.

MCP + RBTC trajectory:
  Build → works → model improves → works better → model improves → works even better
  Net direction: up.
```

## The Principle

**Massively reduced complexity to answer highly complex problems.**

The questions are genuinely hard: multi-entity financial comparisons, trend analysis, cross-system correlation. The systems are genuinely complex: ERP, operations, HR, billing.

The answer doesn't have to be complex. A well-structured data layer, a thin MCP server (~500 lines of tool definitions), role-based tool control (~100 lines), and a world-class reasoning engine (Claude, continuously improving at Anthropic's expense) collapse the complexity into a conversation.

RBTC is the piece that makes this safe to do — not by adding complexity, but by removing it. The manifest tells the truth. The tools are scoped. The reasoning is clean. The user gets their answer.

That's why this exists.

## The People

- **Daniel Shanklin** — Director of AI & Technology. Named the pattern. Asked the question that started it all: *"my tools would be dynamic based on what user I am?"*
- **Claude** (Anthropic's AI) — built the implementation across a marathon session. Made a 2,400-line castle that didn't work. Tore it down. Built RBTC on the rubble. Wrote these docs via a 15-minute loop.
- The executive team whose role-differentiated needs drove the design: a president who sees everything, a CFO who sees financials, a GM who sees operations. Each deserved a focused, honest tool surface — not a chatbot that offers them buttons that don't work.
