# The hosted `[STUDIO_TESSERA] SCHEDULE` workflow (description only)

This document **describes** the hosted n8n Schedule Trigger workflow that drives
`scheduled-runs`. It is intentionally *not* a workflow definition. The poller —
the thing that wakes on a timer, finds due rows, and re-fires tasks — is studio
infra hosted on the shared n8n instance and **never ships into a client repo**.
That boundary is the recurring revenue (baseline §8). This package ships only:

- the `schedules` **table** (`migrations/0001_schedules.sql`),
- the app-side **create/cancel** actions (`reference/actions.reference.ts`),
- the pure **cadence math** (`src/cadence.mjs`),
- and this **description** of the hosted workflow.

There is deliberately **no client-side cron, no committed `*.workflow.json`, and
no scraper/poller code** in this package. A schedule poller appearing in the
client repo would be a boundary violation (reverse-gate B), not a build to retry.

## What the hosted workflow does (the graph, in prose)

```
Schedule Trigger (~every 15 min)
        │
        ▼
Supabase: select due rows
   (service_role; active = true AND next_run_at <= now())
        │
        ▼  (for each due row)
Sign + POST the task's webhook
   (the SAME signed task webhook the manual "run" uses:
    HMAC-SHA256 over `${ts}.${body}`, x-*-timestamp, ≤5-min skew)
        │
        ▼
Code node: ADVANCE the row   ← mirrors src/cadence.mjs exactly
   last_run_at = firedAt
   next_run_at = nextRunAt(row, row.next_run_at)
   if next_run_at === null → active = false   (a 'once' row is done)
        │
        ▼
Supabase: update the row (service_role)
```

### The cadence advance is the one piece that is duplicated — on purpose

The Code node re-implements `nextRunAt` / `advance` from `src/cadence.mjs`. It
**cannot** `import` this package (it runs inside hosted n8n, not the repo), so
the logic is mirrored, and `src/cadence.mjs` is the canonical spec it copies:

| cadence              | next_run_at advances to        |
|----------------------|--------------------------------|
| `once`               | `null` → row goes `active=false`|
| `weekly`             | anchor + 7 days                |
| `monthly`            | anchor + 1 calendar month (day clamped) |
| `custom` (N days)    | anchor + N days                |

The advance anchors off the **scheduled** `next_run_at`, not the firing instant,
so cadence does not drift by the poller's ~15-min granularity. Keep the Code node
and `src/cadence.mjs` in lockstep; the package's `selftest.mjs` pins the expected
outputs so a drift in the spec is caught here even though the hosted copy isn't.

## Why a poller and not a per-row timer

n8n's Schedule Trigger fires the workflow on a fixed cadence (~15 min); the
workflow then *queries* for due rows. One trigger covers every schedule for every
client — there is no per-schedule timer to provision or leak. `email_on_done` is
honoured downstream by the task webhook's own completion path (it emails the
output), not by this workflow.

## Boundary recap

- **Hosted, never handed over:** the Schedule Trigger, the due-row query, the
  signing, the advance Code node, the schedule/cadence on n8n's side.
- **Shipped in the client repo:** the table, the create/cancel actions, the
  cadence math, this doc. Nothing that polls.
- **The signed seam** between them is the existing task webhook (HMAC + ≤5-min
  replay window) — the workflow is just another authenticated caller of it.
