# competitor-pricing-view — read/display the latest competitor-pricing report

A self-contained, reusable feature package: the **client-side** half of the
competitor-pricing feature. It pulls the LATEST already-produced report from the
studio's hosted pricing service and renders it read-only. It is the *exemplar* of
the recurring boundary — the scrape pipeline that produces the report is hosted
IP and is deliberately **not** in here.

```
src/
  fetch-report.mjs              pure: shapeReport() (display formatter) +
                                getLatestReport(fetchFn) (thin read over an
                                INJECTED fetch of the read endpoint)
reference/
  ReportView.reference.tsx      read-only React/Next display component
  results-hook.reference.ts     the read seam: server read-proxy route +
                                client useLatestReport() poller
fixtures/
  latest-report.sample.json     a sample already-produced report
docs/boundary.md                what is hosted vs. what is in the client repo
selftest.mjs                    offline earned checks (formatter + boundary guard)
CLAUDE.md                       hard constraints (the recurring boundary)
```

## The boundary (read this first)

The competitor-pricing **scrape pipeline** — the Firecrawl scrapers, the
schedule, and the structuring/LLM step — is the studio's hosted recurring IP and
runs entirely on `csco.app.n8n.cloud`. **None of it lives here.**

This package contains **only**: a read/display view of the latest already-produced
report, and the results-fetch hook that pulls it. Adding a scraper, a schedule, a
structuring pipeline, or a Firecrawl/OpenRouter call to this package is a
**reverse-gate-B boundary violation, not a build** (see `CLAUDE.md` and
`docs/boundary.md`). `selftest.mjs` enforces this in code.

This mirrors Tessera's read pattern (`apps/web/.../working/WorkingPoller.tsx`,
`lib/n8n.ts`): the run completes server-side regardless of the client; the
client's only job is to READ the result and keep the UI in sync.

## Use

```js
import { getLatestReport, shapeReport } from "@studio/competitor-pricing-view";

// In a server route handler — inject the runtime fetch; the package owns no transport:
const result = await getLatestReport(
  (url) => fetch(url, { headers: { authorization: `Bearer ${process.env.COMPETITOR_REPORT_TOKEN}` } }),
  { endpoint: process.env.COMPETITOR_REPORT_URL },
);
// result = { ok, wired, note, report }  — report already shaped for display.
```

`getLatestReport` is **fail-soft and loud**: with no endpoint it returns
`{ wired: false, note: "NOT WIRED…" }`; on any upstream failure it returns a
`note`, never a silent OK. `shapeReport` is **total** — malformed input degrades
to an empty report rather than throwing, so the view always has something safe to
render.

The reference component + hook (`reference/`) are copied into a client repo and
skinned with brand tokens; they are not compiled by this package.

## Config (env, no secrets)

| Var | Where | Purpose |
|---|---|---|
| `COMPETITOR_REPORT_URL` | server only | the hosted endpoint that serves the latest report |
| `COMPETITOR_REPORT_TOKEN` | server only | optional read auth for that endpoint |

Both are server-side only (never `NEXT_PUBLIC_*`, never committed). The client
reads through an in-app proxy route so neither leaves the server.

## Selftest (earned, offline)

```bash
node selftest.mjs
```

No network and no credentials. It proves two things and earns each pass:

1. **The display formatter** — `shapeReport()` sorts cheapest-first, computes
   deltas vs your price, ranks your position, tolerates nulls, and the fail-soft
   `getLatestReport()` paths all behave — checked against `fixtures/`.
2. **The boundary self-guard** — it scans `src/` + `reference/` for hosted-pipeline
   markers (scrape/Firecrawl/schedule/structuring) and is **watched to fire on a
   planted violation** (negative control) before asserting the real source is
   clean. A guard that cannot catch a bad input is not a guard.

## Boundary, restated

READ-ONLY display of an already-produced report. Producing the report — scraping,
scheduling, structuring — is hosted and out of scope here, by design and by
enforcement.
