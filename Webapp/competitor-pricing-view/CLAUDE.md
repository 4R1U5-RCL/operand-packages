# competitor-pricing-view — Hard Constraints

> Domain CLAUDE.md. Canonical for this package. This is the **exemplar** of the
> recurring boundary (baseline §8 / `packages/integrations`): it is the single
> rule most easily eroded by the instinct to "just add the scraper here." Read
> this before adding anything.

## What this package is

The client-side READ surface of the competitor-pricing feature, and nothing
else:

- a **display view** of the LATEST already-produced report, and
- the **results-fetch hook** (the read seam) that pulls that report.

The report itself is produced entirely by the studio's **hosted** pricing service
on `csco.app.n8n.cloud`. That hosted pipeline is the recurring IP and never
enters this repo.

## HARD constraints — the recurring boundary (baseline §8)

- **This package READS a finished report. It never produces one.** The Firecrawl
  scrapers, the schedule that runs them, and the structuring/LLM step that turns
  raw pages into a report all live on the hosted n8n instance. They never appear
  here.
- **No scraper. No schedule. No structuring/parsing pipeline. No
  Firecrawl/OpenRouter calls.** Any of these appearing in `src/` or `reference/`
  is a **reverse-gate-B boundary violation, not a build to retry.** It moves the
  recurring IP into a client deliverable and dissolves the recurring revenue.
- **The fetch is INJECTED, never owned.** `getLatestReport(fetchFn)` takes the
  caller's `fetch` of the read endpoint. This package constructs no transport,
  no client, no scheduler — only a thin read + pure display formatting.
- **Config via env, no secrets.** The read endpoint (`COMPETITOR_REPORT_URL`) and
  any read token are server-only env, read by the consumer's route handler — never
  committed, never `NEXT_PUBLIC_*`, never hardcoded here.
- **Reversal note (baseline §3):** the instinct from Tessera is "n8n / the scrape
  is the backend, wire it in." Here it is the opposite — the pipeline is a
  separate hosted add-on the repo only *reads from*. Do not rebuild that mental
  model. If a client needs more data, extend the **hosted** report contract and
  surface the field through this view.

## What the evaluator checks here (fixed self-guard)

`selftest.mjs` ALWAYS scans every file under `src/` and `reference/` for the
hosted-pipeline markers (firecrawl, openrouter, scrape/scraper/scraping, crawl,
puppeteer/playwright, cron/schedule). No model discretion over scope.

- No scraping / crawling code present (display view only).
- No schedule/cron present (the run cadence is hosted).
- No structuring/LLM pipeline present (the report arrives already structured).
- The display formatter is proven on a fixture; the boundary guard is watched to
  fire on a planted violation (an honest, earned pass — not "ran without error").

## What stays human / hosted (back gate)

The pricing pipeline's correctness — what to scrape, how often, how to structure
it — is the hosted service's job and the recurring relationship. This package is
not where that is decided or built. It only renders the result faithfully and
reads it safely.
