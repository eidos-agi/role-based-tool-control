# Building with Loops: How This Repo Was Made

This repo wasn't written in one sitting. It was built iteratively via a **looped AI session** — a recurring prompt that fires every 15 minutes, each time adding one focused improvement. The loop is the build process.

## The Mechanism

Claude Code has a `/loop` command that schedules a recurring prompt:

```
/loop 15m improve the rbtc repo a bit each time
```

This creates a cron job (every 15 minutes) that re-enters the conversation with the same instruction. Each firing is one iteration. Each iteration:

1. Assess the current state of the repo
2. Pick the highest-value addition
3. Build it (code, docs, tests)
4. Commit + push
5. Leave a note about what was done and what's next

The human can interrupt, redirect, or let it run. The AI self-paces within each iteration but the cron enforces the cadence.

## How This Repo Was Built

| Iteration | What was added | Why it was next |
|---|---|---|
| 0 (initial) | README, src/ package, tests (34), case studies (Supabase, Workers), examples (Supabase resolver, Cloudflare Worker) | Foundation — the concept, the code, the proof |
| 1 | Quickstart guide, Python example, README navigation | Adoption — someone finds the repo, how do they start? |
| 2 | Scope narrowing doc, Node/Express example | Depth — the most powerful extension, the most common runtime |
| 3 | "RBTC vs Alternatives" comparison, mermaid sequence diagram | Evaluation — someone comparing approaches needs a matrix |
| 4 | Security model, CONTRIBUTING.md, build verification | Credibility — threat model for production evaluation, invitation for contributors |
| 5 | Lessons from Production (the castle story) | Narrative — real failure > hypothetical benefit |
| 6 | Delegation deep-dive, GitHub repo polish (topics, description) | Extension — the most-requested future pattern from the README |
| 7 | This document | Meta — the process itself is a pattern worth sharing |

Each iteration took 5–10 minutes of AI work. Total wall-clock: ~2 hours. Total human input: one `/loop` command + occasional redirects ("add the castle story," "any private data?").

## Why Loops Work for This

### Forced incrementalism

Without the loop, the temptation is to plan everything, write everything, commit everything. That's how castles get built — 2,400 lines that assume the foundation is correct.

The loop forces each iteration to be **self-contained and shippable.** Every commit compiles, tests pass, the repo is in a better state than before. If the loop stops at iteration 3, the repo is still useful — it just has 4 fewer docs.

### Priority naturally emerges

At each iteration, the AI asks: "what's the highest-value addition right now?" Early iterations lay the foundation (README, code, tests). Middle iterations serve adoption (quickstart, examples). Late iterations add depth (security model, delegation, case studies).

Nobody planned this order. It emerged from repeatedly asking "what's missing that would matter most to someone who just found this repo?"

### The human steers, not builds

The human's role shifts from "write the code" to "redirect the loop." Interventions in this session:

- *"I'd also talk about how people could have an opinion on how to do this with Supabase and Cloudflare Workers"* → case studies got written
- *"do the docs include examples of how we tried to build something that didn't work?"* → lessons-from-production got written
- *"any private data in it?"* → security review happened
- *"add as an iteration how you use loops to build yourself"* → this document

Each redirect takes one sentence. The AI translates it into code + docs + tests + commit.

### Quality ratchets up, never down

Every iteration runs `npm test` (34 assertions) and `npm run build` before committing. If a change breaks something, the iteration fixes it before pushing. The repo's quality floor only goes up.

## The Anti-Pattern: The Big Bang

Before we built this repo with loops, we built a 2,400-line OAuth resolver in a single multi-hour session ([full story](./lessons-from-production.md)). That session had:

- No forced stopping points
- No "is this shippable right now?" checks
- No priority reassessment between commits
- 5 rounds of iteration on a foundation that was never verified

The loop would have caught this: iteration 1 builds the resolver. Before iteration 2, the AI checks "does this actually work?" — makes one real HTTP call — discovers the endpoint doesn't exist — pivots. Total waste: 1 iteration instead of 5 rounds.

## How to Use Loops for Your Projects

### For documentation repos (like this one)

```
/loop 15m improve the docs a bit each time
```

Works well because each doc is independent. The AI picks the most impactful missing piece, writes it, moves on. The human redirects when the AI's priorities diverge from theirs.

### For feature development

```
/loop 20m work through the ike task list
```

The AI reads the task tracker (ike.md), picks the highest-priority task, works on it, marks it done, picks the next one. Each iteration is one task. The human monitors via the task list.

### For code review and hardening

```
/loop 15m find and fix one more bug with durable tests
```

This is how 15 real bugs were found in the the-project codebase in one session — the loop kept hunting for adversarial edge cases, writing tests, and fixing what the tests caught.

### For refactoring

```
/loop 10m simplify one thing in src/
```

Each iteration finds the most complex or duplicated piece, simplifies it, verifies tests pass. The codebase gets incrementally cleaner without a risky big-bang refactor.

## Practical Notes

- **15 minutes is a good default.** Long enough for a meaningful change, short enough to force focus.
- **The prompt should be vague on WHAT but clear on WHERE.** "Improve the rbtc repo" → AI decides what to improve. "Add a delegation doc to the rbtc repo" → too specific, kills the loop's value.
- **Redirects are cheap.** If the AI is heading in the wrong direction, one sentence redirects it. Don't wait for the next iteration — interrupt.
- **Loops auto-expire after 7 days.** This is a feature. Infinite loops are how zombie processes happen. If you still need it after 7 days, re-schedule.
- **Each iteration should commit.** Uncommitted work dies when the session ends. The loop's value is cumulative commits, not in-memory state.
