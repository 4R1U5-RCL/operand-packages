# competitor-gap — `[competitor_gap_plugin]` (BASE brick)

SEO-suite brick #4, the competitor / SERP gap finder. A webhook-triggered n8n
system: verify the signed request, ack fast, then work behind the ack — resolve
the competitor set (configured or auto-derived from SERP overlap), pull DataForSEO
Labs to find keywords the competitors rank for that the target does not, assemble
stable-ID gap rows grounded on the ranking facts, cluster/prioritize them through
a fail-open LLM seam, and write a grounded gaps ledger back before pinging the
owner. Every gap traces to a real DataForSEO ranking signal — an empty/errored
pull is recorded honestly, never a fabricated opportunity. A base brick the
SEO-audit orchestrator can compose.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/competitor-gap.json` | The brick's own workflow: webhook → dual HMAC verify → 401 gate → signed 202 ack → spend guard → optional SERP-overlap competitor auto-derive → DataForSEO Labs competitor/gap pull (object-first, honest-empty) → stable `GAP-<class>-<n>` finding ids → fail-open LLM (`executeWorkflow` Cluster + Prioritize) → UPSERT the gaps ledger → signed notify. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered DataForSEO pull — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, technical-audit, content-tracker, seo-improver, seo-audit-orchestrator.)* |
| `supabase/templates/competitor-gap.sql` | The brick-exclusive `tmpl_seo_competitor_gaps` ledger — grounded competitor gaps, service-role-only, `on_conflict (tenant, finding_id, run_date)` for idempotent re-runs. |
