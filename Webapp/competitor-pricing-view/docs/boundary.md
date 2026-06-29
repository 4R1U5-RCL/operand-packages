# Boundary — what is hosted vs. what is in the client repo

The competitor-pricing feature is split across exactly two locations. The split
**is** the recurring revenue: the part that produces the report is the studio's
hosted IP and is never handed over; the client repo gets only a view of the
finished report. This is the `packages/integrations` recurring boundary
(baseline §8) made concrete for this feature.

## The line

| Concern | Lives where | In this package? |
|---|---|---|
| Firecrawl scrapers (fetching competitor pages) | **Hosted — csco.app.n8n.cloud** | ❌ never |
| The schedule / cron that runs the scrape | **Hosted — n8n workflow** | ❌ never |
| Structuring / LLM step that turns raw pages → a report (OpenRouter etc.) | **Hosted — n8n workflow** | ❌ never |
| Storage of historical report snapshots | **Hosted** (derived history; the client reads the latest) | ❌ never |
| The read endpoint that serves the **latest already-produced** report | **Hosted** (exposes the result) | — (called, not built) |
| `src/fetch-report.mjs` — shape/format the report for display | client repo | ✅ |
| `reference/ReportView.reference.tsx` — read-only display | client repo | ✅ |
| `reference/results-hook.reference.ts` — subscribe/pull the latest report | client repo | ✅ |

## Data flow

```
                         (all of this is HOSTED, never in the client repo)
   schedule ─▶ Firecrawl scrape ─▶ structure/LLM ─▶ store snapshot
                                                         │
                                                         ▼
                                              read endpoint (latest report)
   ────────────────────────────────────────────────────┼──────────────────
                                                         ▼   (client repo)
                       getLatestReport(fetch) ─▶ shapeReport ─▶ ReportView
```

The arrow only ever points **out of** the hosted side and **into** the client
repo as a read. Nothing in the client repo points back in to trigger, schedule,
or scrape.

## The reverse-gate-B rule

Adding any hosted-column item to this package — a scraper, a Firecrawl/OpenRouter
call, a schedule/cron, or a structuring/parsing pipeline — is a **reverse-gate-B
boundary violation**, not a feature to build. It moves the recurring IP into a
deliverable the client owns. If a client genuinely needs something the read seam
does not expose, the fix is to change the **hosted** report contract and surface
the new field through this view — never to reproduce the pipeline here.

`selftest.mjs` enforces this in code: it scans `src/` and `reference/` for those
markers and fails (watched against a planted violation) if any appear.
