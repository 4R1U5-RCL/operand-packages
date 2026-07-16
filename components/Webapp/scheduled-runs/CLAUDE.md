# scheduled-runs — Hard Constraints

> Domain CLAUDE.md. Canonical for this feature-package. The generator reads this
> before touching `scheduled-runs`.

## What this package is

A FIXED feature: persist a per-task recurrence cadence (once / weekly / monthly /
custom-N-days) + an `email_on_done` flag, so a **hosted** n8n Schedule Trigger
can poll for due rows and re-fire the task's signed webhook. Configured per
client by tier flag (`features.scheduledRuns`), never rebuilt per client.

## HARD constraints — the recurring boundary (baseline §8)

- **The poller stays hosted, NEVER shipped.** The Schedule Trigger, the due-row
  query, the signing, and the `next_run_at` advance Code node live on the
  studio's hosted n8n instance. This package ships the table + app actions +
  cadence math + a *description* of the workflow ONLY. A schedule poller, a
  committed `*.workflow.json`, or **any client-side cron** in the client repo is
  a boundary violation (reverse-gate B), not a build to retry.
- **The cadence math is the spec, the hosted Code node mirrors it.** `src/
  cadence.mjs` is canonical and dependency-free; the hosted advance copies it
  because it cannot import the repo. Keep them in lockstep — `selftest.mjs` pins
  the expected outputs so spec drift is caught here.
- **The seam is the existing signed task webhook.** The hosted workflow is just
  another authenticated caller (HMAC-SHA256 over `${ts}.${body}`, ≤5-min replay
  window). This package does not invent a second auth path.

## HARD constraints — data boundary (baseline §8.1)

- **`schedules` is app data Shopify doesn't own** (shape #1: dashboard/app
  state). It MUST NOT mirror Shopify order/stock/payment state. Cadence is
  net-new app state, not a copy of commercial truth.
- **RLS by default + REVOKE discipline.** The table ships owner-scoped RLS and
  `REVOKE all … from anon, public` from the start. A missing/loose policy or a
  table reachable without a policy is a HARD finding (the gap that let Tessera's
  DEFECT-1 through). Service-role is the poller's only privileged path.

## What the evaluator checks here

- No poller / cron / `*.workflow.json` in the package — hosted workflow is
  described, not reproduced.
- `migrations/0001_schedules.sql`: RLS enabled, owner-scoped policy, REVOKE from
  anon/public, cadence pinned by a check constraint.
- `src/cadence.mjs` stays pure (caller-injected `from`/`now`, no clock/DB/net)
  and `selftest.mjs` earns its pass.

## Tier gating

`features.scheduledRuns` off → the migration ships dormant (table present, no UI
to create rows) and no hosted poller is provisioned for the client. The package
ships; it stays inert behind the flag.

## What stays human

Whether a given task *should* be allowed on an aggressive cadence (cost/rate
judgement) is an operator call at intake, not something the pipeline decides.
