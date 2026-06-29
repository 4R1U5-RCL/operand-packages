# scheduled-runs — recurring task runs (table + app actions + cadence math)

A self-contained, reusable feature-package: let a user put a task on a cadence
(**once / weekly / monthly / custom-N-days**) and optionally email the output
when each run finishes. A **hosted** n8n Schedule Trigger polls every ~15 min,
fires due rows via the existing **signed task webhook**, and advances each row's
`next_run_at`. This package ships everything the *client app* needs — and nothing
that polls.

> The poller is studio infra, hosted on the shared n8n instance, and **never
> handed over**. That boundary is the recurring revenue (baseline §8). What ships
> here is the table, the create/cancel actions, the cadence math, and a
> *description* of the hosted workflow — there is no client-side cron and no
> committed workflow definition.

```
scheduled-runs/
  src/cadence.mjs                  CORE — pure nextRunAt()/isDue()/advance() (Node 22 built-ins, offline-testable)
  migrations/0001_schedules.sql    the schedules table: owner-scoped RLS + REVOKE
  reference/actions.reference.ts   app-side createSchedule / cancelSchedule (soft) / deleteSchedule
  docs/n8n-schedule-workflow.md    DESCRIBES the hosted Schedule Trigger workflow + the boundary
  selftest.mjs                     offline earned checks (no clock, no DB, no network)
```

## The split — what ships vs. what stays hosted

| Piece                              | Where it lives        | In the client repo? |
|------------------------------------|-----------------------|---------------------|
| `schedules` table + RLS            | Supabase (app DB)     | **yes** (migration) |
| create / cancel / delete actions   | app `(app)/tasks/[id]`| **yes** (reference) |
| cadence math (`nextRunAt`/`isDue`) | `src/cadence.mjs`     | **yes** (CORE)      |
| the poller, due-row query, advance | hosted n8n + Code node| **no** — described only |

The cadence math is duplicated **on purpose**: the app uses it to seed the first
run; the hosted Code node mirrors it to advance subsequent runs. `src/cadence.mjs`
is the canonical spec, and `selftest.mjs` pins its outputs so a drift is caught
here even though the hosted copy can't `import` it.

## The CORE (`src/cadence.mjs`)

Pure, clock-free, dependency-free. The caller injects `from` / `now`, so every
result is reproducible offline.

```js
import { nextRunAt, isDue, advance } from "./src/cadence.mjs";

nextRunAt({ repeat: "once" },                  from);   // → null   (no recurrence)
nextRunAt({ repeat: "weekly" },                from);   // → from + 7d  (ISO)
nextRunAt({ repeat: "monthly" },               from);   // → from + 1 calendar month (day clamped)
nextRunAt({ repeat: "custom", customDays: 10}, from);   // → from + 10d

isDue({ active: true, next_run_at }, now);               // active && next_run_at <= now
advance(row, firedAt);  // → { last_run_at, next_run_at, active? } patch; once → null + inactive
```

Edge cases it pins: `monthly` clamps Jan-31 → Feb-28; `custom` rejects
non-positive / non-integer N; `isDue` is false for inactive / null-next /
exactly-now is *due*; `advance` anchors off the scheduled instant so cadence
does not drift by the poller's granularity.

## The table (`migrations/0001_schedules.sql`)

`schedules` holds the cadence — **app data Shopify doesn't own** (baseline §8.1,
shape #1), never mirrored commercial state. It ships with the studio's standing
DB discipline: **RLS enabled, owner-scoped policy, service-role for the poller,
and `REVOKE all … from anon, public`** so the table is reachable only through a
policy. A `check` constraint pins the cadence vocabulary in-DB and requires
`custom_days` exactly for `custom`. Apply via the Supabase Management API.

## The app actions (`reference/actions.reference.ts`)

`.reference.ts` because they are Next.js / Supabase-shaped — drop them into the
client app's `tasks/[id]` surface and wire to the real `@/lib/supabase`. Same
discipline as Tessera's `extra-actions.ts`: every read/write goes through the
RLS-scoped server client, so a user only ever touches their own rows.
`cancelSchedule` is a **soft** cancel (flip `active=false`, keep history);
`deleteSchedule` is the hard path.

## Selftest (earn the pass)

```bash
node selftest.mjs
```

No clock, no DB, no network. Asserts `nextRunAt` for every cadence, `isDue`'s
edge cases, `advance`'s once→inactive transition, **and** that the migration text
actually contains the RLS-enable + owner policy + REVOKE it claims (so a refactor
that drops the security discipline fails the test, not just review). Exits 0 only
if every assertion holds.

## Boundary

The hosted Schedule Trigger workflow — poller, due-row query, signing, the
`next_run_at` advance — **stays hosted and is never reproduced in a client
repo**. A schedule poller, a committed `*.workflow.json`, or any client-side cron
appearing here is a boundary violation (reverse-gate B), not a build to retry.
