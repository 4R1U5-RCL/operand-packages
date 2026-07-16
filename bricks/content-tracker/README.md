# content-tracker — `[content_tracker_plugin]` (BASE brick)

SEO-suite brick #3, the content / on-page tracker — answers "are my page's words
good for SEO?" and works on a *new* site with no rankings yet. A webhook-triggered
n8n system: verify the signed request, ack fast, then work behind the ack —
Firecrawl-scrape the target URL for its on-page signals (title / meta / headings /
word count / keyword presence), pull DataForSEO Labs volume/difficulty for the
target terms, assemble deterministic stable-ID content issues (coverage, thin
content, title/meta length, intent-mismatch), rank them through a fail-open LLM
seam, and write a grounded findings ledger back before pinging the owner. Every
finding traces to a scraped signal or a keyword fact — an empty/errored scrape is
recorded honestly, never a fabricated issue. A base brick the SEO-audit
orchestrator can compose.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/content-tracker.json` | The brick's own workflow: webhook → dual HMAC verify → 401 gate → signed 202 ack → spend guard → Firecrawl `/v1/scrape` on-page signals (object-first, honest-empty) → DataForSEO Labs bulk difficulty for the target terms → deterministic content issues with stable `CONTENT-<class>-<n>` ids → fail-open LLM (`executeWorkflow` Content Gap) synthesis → UPSERT the findings ledger → signed notify. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered DataForSEO pull — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, technical-audit, competitor-gap, seo-improver, seo-audit-orchestrator.)* |
| `supabase/templates/content-tracker.sql` | The brick-exclusive `tmpl_seo_content_findings` ledger — grounded content findings, service-role-only, `on_conflict (tenant, finding_id, run_date)` for idempotent re-runs. |
