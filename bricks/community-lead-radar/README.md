# community-lead-radar — `[dirnotif_plugin]` (BASE scraper + add-ons)

A social-listening system that watches developer and business communities,
LLM-qualifies each new post for genuine intent, and pings the owner with a brief and
a value-first angle — detection automated, every reply written by a human. A scraper
base (poll official APIs → dedupe → cursor) → keyword pre-filter → LLM enrichment →
Telegram ping (hot) + daily email digest (the rest). A base scraper other packages
stack onto.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/schedule-dispatcher.json` | The scraper base's clock: cron → query due → filter → fire → write-back with a durable per-source cursor. *(SHARED with seo-improver.)* |
| `n8n/workflows/read-only-json-api.json` | Polling official structured APIs (HN via Algolia, n8n forum via Discourse) — GET → shape → respond read pattern. |
| `n8n/workflows/llm-doc-pipeline-mono.json` | One JSON-only, spend-guarded LLM pass for intent qualification. *(SHARED with llm-lead-enrichment.)* |
| `n8n/workflows/notification-fanout.json` | High-scoring leads ping the owner live on Telegram — channel-parameterised notify fan-out. *(SHARED with seo-improver.)* |
| `n8n/workflows/email-report.json` | Everything else → a daily email digest — the email-report composer. *(SHARED with email-lead-qualifier.)* |
| `Webapp/spend-gate` | Hard daily spend cap with an alert on the LLM pass. *(SHARED with llm-lead-enrichment, seo-improver.)* |
| `supabase/templates/public-capture.sql` | The seen-table (dedupe) shape. |
| `supabase/templates/derived-history.sql` | Stored scoring / feedback history — append-only. |
