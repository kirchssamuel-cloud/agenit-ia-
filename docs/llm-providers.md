# LLM provider strategy — cost optimization

**Last updated:** May 11, 2026
**Owner:** Samuel + Claude Code agent
**Status:** Active — Gemini scout in `/api/agent-gemini-test`, router not built yet

---

## Mission

Reduce per-message agent cost to **< $0.005 USD** without sacrificing
the conversational quality needed to sell this agent. Target volume:
1500–3000 messages/day across 10–50 paying clients.

Current model: **Claude Sonnet 4.6** (~$0.012/message). 2.4× too expensive
at scale: $360–720/month for the target volume.

---

## Candidate models (May 2026 data)

| Model | $/MTok in | $/MTok out | $/msg agent¹ | Speed (t/s) | Tool use | Notes |
|---|---|---|---|---|---|---|
| Claude Sonnet 4.6 (current) | $3.00 | $15.00 | $0.012 | ~120 | ✅ Native | Quality benchmark, too expensive |
| **Claude Haiku 4.5** | $1.00 | $5.00 | $0.005 | ~150 | ✅ Native | Same provider, easy fallback |
| Claude Opus 4.7 | $5.00 | $25.00 | $0.025 | ~80 | ✅ Native | Reserve for hardest cases only |
| **Gemini 2.5 Flash** | $0.30 | $2.50 | $0.002 | 249 | ✅ Native | **Free tier 500/day, $0** |
| Gemini 2.5 Flash-Lite | $0.04 | $0.10 | $0.0001 | 363 | ✅ Native | Free tier 1000/day, weaker quality |
| GPT-5.4 Mini (OpenAI) | $0.75 | $4.50 | $0.004 | 202 | ✅ Native | Slightly higher quality than Gemini Flash |
| DeepSeek V3.1 | $0.15 | $0.75 | $0.001 | ~100 | ✅ | Via OpenRouter +5% markup |
| DeepSeek V3.2 | $0.25 | $0.38 | $0.0008 | ~100 | ✅ | New agentic tuning, recommended over V3.1 |

¹ Assumes a typical agent message: ~3000 input tokens (system prompt
+ memories + 1 prior turn) and ~200 output tokens.

Sources:
- [Galaxy.ai Haiku 4.5 vs Gemini 2.5 Flash](https://blog.galaxy.ai/compare/claude-haiku-4-5-vs-gemini-2-5-flash)
- [Iternal LLM benchmarks 2026](https://iternal.ai/llm-selection-guide)
- [Macaron Flash Lite vs GPT-4o Mini vs Haiku](https://macaron.im/blog/gemini-flash-lite-vs-gpt4o-mini-vs-claude-haiku)
- [OpenRouter DeepSeek V3](https://openrouter.ai/deepseek/deepseek-chat)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

---

## Quality ranking (conversational + light tool use)

Based on public benchmarks (MMLU, SWE-bench, Arena Elo) and conversational
evaluations cited in the sources above. Differences in our use case
(French B2B agent, BTP/commercial/comptability) are smaller than benchmark
gaps suggest because we provide heavy system prompts that pre-load the
domain knowledge.

```
Sonnet 4.6  ████████████████████  baseline (100%)
GPT-5.4 Mini ███████████████████░  ~95%
Haiku 4.5    ██████████████████░░  ~90%
DeepSeek V3.2 █████████████████░░░  ~88%
Gemini 2.5 Flash ████████████████░░░░  ~85%
DeepSeek V3.1 ██████████████░░░░░░  ~80%
Flash-Lite    █████████████░░░░░░░  ~75%
```

---

## Decision

**Default model: Gemini 2.5 Flash**
- $0 in free tier (500 req/day, ≈15 active clients with 30 msg/day each)
- $0.002/msg when paid (still 6× cheaper than Sonnet)
- Quality holds for casual conversation + sector knowledge + simple tool use

**Escalation to Claude Haiku 4.5** when:
- Conversation has ≥3 tool calls in a single turn (complex agentic flow)
- The supervisor agent (in `brain.ts`) is invoked (precision matters for
  email/CRM push approval)
- Gemini free tier quota is exhausted (HTTP 429 from Google AI)
- Same provider as Sonnet, drop-in via Anthropic SDK

**Reserve for hardest cases (Sonnet 4.6 or Opus 4.7):**
- Multi-document analysis
- Code generation
- Explicit user request "/deep" or "/think"

### Why not GPT-5.4 Mini

Marginally better quality than Gemini Flash, but **2× more expensive**
and adds an OpenAI dependency without strategic value. Keep as a tertiary
fallback option, not in the hot path.

### Why not DeepSeek V3.2

Excellent price/quality ratio on paper. **Risks**: (1) routed via
OpenRouter, adding a single point of failure; (2) Chinese provider, may
raise concerns for B2B clients in finance/legal verticals; (3) less
battle-tested in production agentic loops. Worth re-evaluating in Q3
2026.

### Why not Flash-Lite

Quality drops noticeably for nuanced French and sector vocabulary. Free
tier 1000/day is tempting but the user experience degrades. Keep for
batch/non-conversational tasks if we add any.

---

## Cost projection at target volume

**1500 messages/day across 10 clients (sample mix):**

| Strategy | Daily cost | Monthly cost |
|---|---|---|
| Current (all Sonnet) | $18 | $540 |
| All Haiku 4.5 | $7.50 | $225 |
| All Gemini Flash (paid) | $3 | $90 |
| **Hybrid (90% Gemini / 10% Haiku)** | **$3.45** | **$103** |
| All Gemini Flash (free tier saturated, partial paid) | $1–2 | $30–60 |

**3000 messages/day across 50 clients:**

| Strategy | Daily cost | Monthly cost |
|---|---|---|
| Current (all Sonnet) | $36 | $1080 |
| **Hybrid (90% Gemini / 10% Haiku)** | **$6.90** | **$207** |

At 50€/client/month (commercial pricing), 10 clients = 500€/mo gross,
50 clients = 2500€/mo gross. Hybrid LLM cost = 4–10% of revenue.
Healthy gross margin.

---

## Implementation status

- [x] **Phase 0 — Gemini scout** (PR #24, merged May 11)
  - `src/lib/llm/gemini-client.ts` — fetch wrapper for Google AI Studio
  - `src/app/api/agent-gemini-test` — endpoint to A/B quality vs brain.ts
  - `.env.example` documents `GEMINI_API_KEY`
  - **Requires Samuel to add `GEMINI_API_KEY` in Vercel + redeploy** before tests run

- [ ] **Phase 1 — Validate Gemini quality**
  - Run the 4 reference tests via `/api/agent-gemini-test`
  - "Salut" / "Devis 50m² carrelage premium" / "120€ essence carte pro" /
    "Brief RDV solaire Mme Martin"
  - Subjective quality + latency + token counts logged here
  - Decision: ship to brain.ts (yes/no)

- [ ] **Phase 2 — Multi-provider router** (`src/lib/llm/router.ts`)
  - Same interface as `Anthropic.messages.create()` to minimize brain.ts diff
  - Default: Gemini Flash
  - Escalate: Haiku 4.5 (tool-heavy / supervisor)
  - Reserve: Sonnet 4.6 (user `/think` flag)
  - Fallback chain on errors (429, 5xx) — never break a conversation

- [ ] **Phase 3 — Tool use parity**
  - Convert Anthropic tool format ↔ Gemini function calling format
  - Convert OpenAI tool format if/when we route to GPT-5.4 Mini
  - Round-trip tested with at least one tool (web-search recommended)

- [ ] **Phase 4 — Production switchover**
  - Default brain.ts to the router
  - Monitor cost via the existing `costCents` field in `agent_conversations`
  - Compare to `$0.012/msg` baseline; target ≤ `$0.003/msg` average

---

## Test results (filled as we run them)

### Phase 1 reference tests via `/api/agent-gemini-test`

> **Pending** — waiting for `GEMINI_API_KEY` to be configured in Vercel
> production environment.

| Prompt | Latency | Tokens (in/out) | Cost | Quality (1-5) | Notes |
|---|---|---|---|---|---|
| "Salut" | — | — | — | — | — |
| "Devis 50m² carrelage premium" | — | — | — | — | — |
| "120€ essence carte pro" | — | — | — | — | — |
| "Brief RDV solaire Aix" | — | — | — | — | — |

---

## Open questions

- Does Gemini 2.5 Flash hold up on French B2B sector vocabulary the way
  the prompt teaches it? Need real tests.
- Tool calling fidelity: when Gemini decides to invoke `web-search`, does
  it choose the right query as well as Claude does? Same for `send-email`?
- Streaming UX on WhatsApp: not relevant since we send one final message,
  but worth considering for the web portal later.
