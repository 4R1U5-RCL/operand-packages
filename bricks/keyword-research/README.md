# keyword-research — `[keyword_research_plugin]` (BASE brick)

SEO-suite brick #1, the keystone keyword-research primitive. A webhook-triggered
n8n system: verify the signed request, ack fast, then work DataForSEO Labs
asynchronously behind the ack — pull keyword ideas + bulk keyword difficulty,
cluster/intent-classify through a fail-open LLM seam, and write a grounded,
stable-ID keyword ledger back before pinging the owner. Every keyword traces to a
real DataForSEO signal — an empty/errored pull is recorded honestly, never
fabricated. A base brick the SEO-audit orchestrator composes.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/keyword-research.json` | The brick's own workflow: webhook → dual HMAC verify → 401 gate → signed 202 ack → spend guard → DataForSEO Labs keyword_ideas + bulk difficulty (object-first, honest-empty) → fail-open LLM cluster/intent seam → stable `KW-<cluster>-<n>` ids → UPSERT the keyword ledger → signed notify. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered DataForSEO pull — the shared `global_send_quotas` counter + gate. *(SHARED with technical-audit, seo-improver, seo-audit-orchestrator.)* |
| `supabase/templates/keyword-research.sql` | The brick-exclusive `tmpl_seo_keyword_research` ledger — grounded keyword rows, service-role-only, `on_conflict (tenant, keyword, run_date)` for idempotent re-runs. |
