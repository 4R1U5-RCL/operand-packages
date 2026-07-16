# scheduled-digest — `[scheduled_digest]` · Digest (BASE — the digest engine)

A reusable **scheduled-digest engine**: on a cron it reads a period's rows from a
parameterized source, optionally summarizes them via a **fail-open** LLM pass,
composes a **grounded** digest (it never fabricates a number — honest-failure copy
when the facts are unavailable), delivers via signed notification fan-out and/or
email, and **logs the run idempotently**. It generalizes the identical middle+tail of
Radar's Daily Digest and the Analytics Digest into one engine with two swapped
nose-cones (the source read + the compose render fragment, caller-supplied via
slots). The engine owns the grounding gate, the exactly-once dedup, and the delivery
envelope — enforced once, not re-implemented per digest. Marketed publicly as
**Digest**. Full design: `SPEC_operand-scheduled-digest_2026-07-16.md`.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/schedule-dispatcher.json` | The engine's clock: cron → derive period → read due rows → act → write-back. The cron spine the digest engine's Compute-Period + read-source nose-cone hangs off. *(SHARED shape with community-lead-radar, seo-improver.)* |
| `n8n/workflows/notification-fanout.json` | The signed `[STUDIO_NOTIFICATIONS]` delivery leg (Telegram and/or the parameterised email leg). *(SHARED with telegram-triage, content-wall.)* |
| `Webapp/spend-gate` | Daily spend cap on the optional LLM summary child — over cap the summary is skipped, the deterministic grounded digest still ships. *(SHARED with llm-lead-enrichment, community-lead-radar, seo-improver.)* |
| `supabase/templates/idempotent-run-log.sql` | **The send-log shape** — one row per `(client_id, period_key)` with a UNIQUE index as the exactly-once race arbiter; a duplicate cron fire loses the INSERT, so re-firing is a no-op. |

## Planned components (do NOT exist in the repo yet)

See `planned[]` in [`brick.json`](brick.json):

- The `scheduled-digest` workflow builder — the read → summarize → deliver → log
  engine spine (Compute Period, dedup guard, grounding gate, fail-open summary
  seam, delivery legs, idempotent log); consumers supply the source-read + compose
  nose-cone via slots.
- `tmpl_scheduled_digest_log` — the brick-exclusive run ledger (the generic
  `idempotent-run-log.sql` snapshot shows its shape).
