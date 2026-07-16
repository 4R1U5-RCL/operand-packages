# llm-lead-enrichment — `[llmenri_plugin]` (ADD-ON brick)

An add-on package that layers one LLM pass — intent, band refinement, entities, a
suggested human reply — over both lead-response systems (`sms-lead-qualifier`,
`email-lead-qualifier`) through their declared seams, without modifying either. One
enrichment workflow: verify → dedupe → spend-guard → one LLM pass → clamp →
write-back; never in the critical path. The add-on brick — proof the seams are real.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/llm-doc-pipeline-mono.json` | The guarded LLM chain: analyse → … → compose → store with per-stage cost logging + daily spend guard (plain OpenRouter HTTP). *(SHARED with community-lead-radar.)* |
| `n8n/workflows/orchestrator-routing.json` | The add-on is reached via `executeWorkflow` dispatch — the orchestrator / sub-workflow routing pattern (resource-locator child). |
| `n8n/workflows/outbound-verdict-callback.json` | write-back with cost + latency — enrichment lands on the lead row (push → verdict → map → re-enter). |
| `Webapp/spend-gate` | Daily cost cap: `get_daily_token_spend()` RPC + pricing-truth module; over the cap the model is skipped. *(SHARED with community-lead-radar, seo-improver.)* |
| `supabase/templates/derived-history.sql` | Enrichment write-back appended alongside the rule band — append-only derived-history shape. |
