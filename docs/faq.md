# FAQ: Common Objections

Honest answers to the pushback we hear most.

---

**"We already have a chatbot. Why would we switch?"**

You don't have to switch. But ask: when the AI model you're using ships its next major upgrade, how many weeks will your team spend re-tuning prompts and fixing broken guardrails? With RBTC + MCP, model upgrades improve your AI automatically. Zero engineering. Your chatbot is a fixed cost that breaks on upgrades. A connector is a one-time cost that improves on upgrades.

---

**"This just works with Claude. We don't want to be locked to Anthropic."**

RBTC works with any MCP client — Claude, ChatGPT (when it ships MCP support), Cursor, Zed, local LLMs via Ollama. The tool definitions are model-agnostic. Switching providers means connecting a different client to the same tools. That's the opposite of lock-in — it's the most portable AI integration architecture available today.

---

**"Our data is too sensitive for AI."**

RBTC doesn't send your data to the AI for training. MCP tool calls are real-time queries — the AI asks for specific data, your server returns it, the conversation ends. Nothing is stored by the AI company beyond the conversation window. Add to that: RBTC scopes which tools each user can see, and database-level row security (RLS) scopes which data each query can return. Two layers of access control on top of whatever your database already enforces.

---

**"We need to control the UX. A connector gives us no control over how things look."**

True — you don't control Claude's chat interface. But consider: do you want to control the chat UI, or do you want your team to get answers? Anthropic has hundreds of engineers making the Claude interface better every week. Your team would spend months building a chat UI that's worse. The tradeoff is: give up UX control, get a world-class interface for free. Most companies make this tradeoff happily when they see it clearly.

---

**"We're a small company. This is enterprise stuff."**

RBTC was built BY a small company. The entire implementation is ~100 lines of TypeScript. The MCP server that runs it costs $0/month on Cloudflare's free tier. The database is Supabase (free tier handles thousands of users). There's no minimum company size. If you have data and people who ask questions about it, this works.

---

**"What if the AI hallucinates answers?"**

Two things reduce this dramatically: (1) The AI is calling real tools that return real data — it's not guessing from training data. When Claude calls `get_revenue({period: "2026-03"})`, it gets the actual number from your database. (2) RBTC means the AI only has tools relevant to the question. Fewer irrelevant tools = less noise in the AI's reasoning = fewer hallucinations.

That said, AI can still misinterpret results or make reasoning errors. The same is true of a human analyst reading a spreadsheet. The difference: the AI shows its work (tool calls are logged), and you can ask follow-up questions instantly.

---

**"We tried AI and it didn't work for us."**

Most AI failures are chatbot failures — building a custom chat UI with custom prompts on top of an AI model. That's 6 layers of code, each of which can fail. RBTC + MCP is 2 layers. The failure modes are fundamentally different:

| Chatbot failure | Why it happened | RBTC equivalent |
|---|---|---|
| AI said something wrong | Prompt was too broad | Tools scope what AI can do |
| AI offered unauthorized action | All tools visible to all users | RBTC hides unauthorized tools |
| Upgrade broke everything | Prompts tuned to old model | Tools are model-agnostic |
| Nobody used it | UX was bad | Claude's UX is world-class |
| Cost too much to maintain | 35,000 lines of code | 650 lines |

---

**"How is this different from just putting an API key on our database?"**

Three ways: (1) RBTC adds role-based tool visibility — different users see different capabilities, not just different data. (2) The AI reasons about tools before calling them — it can compose multiple queries, explain results, and answer follow-ups. An API key just returns JSON. (3) MCP is a standard protocol that any AI client can speak — you're not building a custom integration for each consumer.

---

**"What happens if the AI is down?"**

Your data and tools still exist. MCP is just a protocol. If Claude is down, your team uses the dashboard (which reads the same database). If you want redundancy, connect a second AI client (ChatGPT, a local LLM). Same tools, different client. Your data layer is the constant; the AI is interchangeable.

---

**"We need compliance / SOC 2 / audit trails."**

RBTC's audit property: every tool call in the logs was authorized at the manifest level. If a call appears, the tool was in the caller's manifest, which means their role permitted it. This is a stronger guarantee than most custom chatbots provide (where you have to distinguish "authorized call" from "unauthorized attempt that was blocked"). Add telemetry and you get: who called what, when, with which role, what data was returned, in a structured event stream.

---

**"This sounds too simple. What's the catch?"**

The catch is that simplicity requires discipline. RBTC is ~100 lines because it does one thing: gate tool visibility by role. It doesn't replace your auth system, your database security, your data pipeline, or your monitoring. It's one layer in a stack. The simplicity is a feature — it means there's less to break, less to maintain, and less to debug. The 2,400-line version of this pattern already exists. It was built and torn down in a single day. [That story is worth reading.](backstory/lessons-from-production.md)
