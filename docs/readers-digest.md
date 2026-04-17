# The Simple Version

You want AI to help your team answer business questions. You have two choices.

## Choice A: Build Your Own AI Chat

You build a website with a chat interface. You pick an AI model. You write the conversation logic, the message history, the login system, the permission rules, the error handling, and the connection to your data. You maintain all of it.

## Choice B: Connect to Claude (or ChatGPT, or any AI)

You write a small connector that describes your data as tools. Claude already knows how to chat, remember conversations, handle errors, and reason about complex questions. You just tell it what data you have. It does the rest.

**RBTC makes Choice B secure** — so the CFO sees financial tools, the operations manager sees fleet tools, and a regular employee sees the basics. Each person's AI experience matches their actual job.

## The Comparison

| | Build your own AI chat (Choice A) | Connect to Claude with RBTC (Choice B) |
|---|---|---|
| **Chat interface** | You build it | Claude has it |
| **Conversation memory** | You build it | Claude has it |
| **Error handling** | You build it | Claude has it |
| **Safety filters** | You build it | Claude has it |
| **Reasoning ability** | You pick a model + write prompts | Claude's built-in (world-class) |
| **Your data connection** | You build it | You build it (~500 lines) |
| **Who sees what** | You build it | RBTC handles it (~100 lines) |
| **Total code you maintain** | 15,000–35,000 lines | ~650 lines |
| **When AI gets smarter** | Your prompts break, you rebuild | It just works better automatically |
| **Adding a new employee** | Update permissions + re-test prompts | Add one row to the database |
| **Switching AI providers** | Rewrite everything | Change which app you connect to |
| **Cost to build** | Months | Days |
| **Cost to maintain** | Ongoing engineering team | Nearly zero |

## What Happens When AI Improves

This is the part most people miss.

**Choice A (your own chat):** Every time the AI model gets an upgrade, your carefully written prompts and rules might stop working. Teams spend weeks re-tuning after every model change. Your AI gets *temporarily dumber* after every upgrade until you fix it.

**Choice B (connector):** The AI model gets an upgrade. Your connector didn't change. The same tools get called by a smarter brain. Your AI gets *smarter for free.* No engineering work. No re-tuning. Just better answers.

```
Choice A: build → works → AI upgrades → breaks → rebuild → works → AI upgrades → breaks
Choice B: build → works → AI upgrades → works better → AI upgrades → works even better
```

## Why Big Companies Get This Wrong

Chipotle built an AI ordering assistant. Someone asked it to write Python code. It did — happily — then asked if they'd like a burrito.

![Chipotle's chatbot writing Python code instead of taking a food order](images/chipotle-chatbot.jpg)

Air Canada's chatbot promised a discount that didn't exist. The company was forced to honor it in court.

McDonald's drive-through AI added hundreds of dollars of random food to orders.

**Every one of these failures happened because the AI had access to capabilities it shouldn't have had in that context.** The Chipotle bot could write code because nobody told it "you only do food orders." The Air Canada bot could promise discounts because nobody scoped its responses to actual policies.

RBTC prevents this. The AI literally cannot propose a tool that isn't in its manifest for this user. A food-ordering AI would have food-ordering tools. Period. No Python, no fake discounts, no random additions.

## Who Should Care

- **Business leaders** evaluating AI: Choice B is 50x less code, improves automatically, and prevents the embarrassing chatbot failures that make headlines.
- **Developers** building MCP servers: RBTC is ~100 lines that make your tool server enterprise-grade. [Quick start →](quickstart.md)
- **Anyone comparing AI vendors**: with Choice B + RBTC, you're not locked to one vendor. Switch from Claude to ChatGPT to a private model — same tools, same security, different brain.

## One Sentence

**Instead of building an AI chat application (expensive, fragile, gets dumber over time), connect your data to an existing AI via a secure tool layer (cheap, durable, gets smarter over time).**
