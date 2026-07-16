# gsc-csv — `[gsc_csv_plugin]` (BASE brick)

SEO-suite wave-4 brick, the Google-Search-Console **CSV stopgap**: real
query-level performance data before (or in lieu of) a live GSC OAuth
integration. A webhook-triggered n8n system — verify the signed request, ack
fast — that takes the client's own GSC *Performance* export (their own facts, no
metered API to gate), parses and normalizes the rows, and UPSERTs them into a
performance table keyed on `(tenant, property, query, page, date)` so a re-upload
of the same window is idempotent. From those rows it derives deterministic
findings — high-impression / low-CTR outliers and query-cannibalization (the
same query splitting clicks across pages) — writes them to a findings ledger,
runs them through a fail-open LLM draft-suggestions seam (a bare, functional set
of findings still ships when no model is bound), and pings the owner over the
signed notify seam. A pure parser: no DataForSEO, no Firecrawl, no spend gate.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/gsc-csv.json` | The brick's own workflow: webhook → dual HMAC verify → 401 gate → signed 202 ack → parse the uploaded GSC Performance CSV → normalize rows → UPSERT `tmpl_gsc_performance` → deterministic CTR-outlier + cannibalization findings → UPSERT `tmpl_seo_gsc_findings` → fail-open LLM (`executeWorkflow` Draft Suggestions) → signed notify. No spend guard — the client's own export is the fact source. |
| `supabase/templates/gsc-csv.sql` | The brick-exclusive PAIR — `tmpl_gsc_performance` (normalized Performance-export rows, `on_conflict (tenant, property, query, page, date)` for idempotent re-uploads) + `tmpl_seo_gsc_findings` (derived CTR-outlier / cannibalization findings). Server-write-only; no public read surface. |
