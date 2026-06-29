# packages — reusable studio tooling

Standalone, reusable tooling that serves the studio but isn't part of any single
client build or the harness. Each package is self-contained and is **consumed by
pulling a pinned version**, never copy-forked into a container.

## Layout

- **[`Claude/`](Claude/)** — agent-side tooling for the studio (4 packages).
- **[`Webapp/`](Webapp/)** — reusable web-app feature-packages extracted from Tessera
  (11 packages — see [`Webapp/README.md`](Webapp/README.md)).
- **[`supabase/`](supabase/)** — reusable Supabase **schema templates** (6 idempotent
  RLS migrations / 7 tables for the §8.1 data shapes — see
  [`supabase/README.md`](supabase/README.md)).

## `Claude/` — agent-side tooling

| Package | What it is |
|---------|------------|
| [`Claude/audit/`](Claude/audit/) | ATT&CK × ISO 27001 × SOC 2 security verification for the studio stack — a deterministic check core with three entry points (agent skill, CI gate, scheduled runner). Every check is self-guarded so a pass is earned, never assumed. |
| [`Claude/hygiene/`](Claude/hygiene/) | Config/codebase hygiene across three pluggable profiles (`claude` home-tree relocation, `codebase` git-aware backup + junk-drift report, `llm-artifacts` transcript backup). `cleanup` drift detector + self-verifying `backup`; report-only on non-`claude` profiles. Self-guarded so a pass is earned. |
| [`Claude/consult/`](Claude/consult/) | Multi-model cross-validation — `research` + `validate` over one LiteLLM chain (base → GPT-5 → Gemini, optional Perplexity). Self-guarded offline; a corroborated/HIGH verdict needs the tiers to have actually responded, else `unknown` — never a fabricated answer. |
| [`Claude/notify/`](Claude/notify/) | Claude Code → Telegram notifier. A `Notification`/`Stop` hook POSTs a signed event to the hosted `[STUDIO_NOTIFICATIONS]` n8n workflow, which pings Telegram (🟡 needs input / 🟢 done). Header-Auth + HMAC-signed; the live channel is proven via the n8n executions API. |

## `Webapp/` — web-app feature-packages (from Tessera)

Self-contained, env-driven, HMAC + ≤5-min replay on every webhook seam, with an
offline `selftest.mjs` whose pass is earned. **Recurring boundary:** n8n workflow
*definitions* stay hosted; packages ship only the signed hook/route, a display
view, migrations, and a doc of the matching n8n node.

| Package | What it is | Status |
|---------|------------|--------|
| [`Webapp/n8n-trigger/`](Webapp/n8n-trigger/) | **Foundational** signed-webhook seam: server-only client firing a hosted n8n workflow (timestamped HMAC) + the inbound verifier. The pattern the other n8n features reuse. | selftest ✓ |
| [`Webapp/inbound-email/`](Webapp/inbound-email/) | Resend inbound webhook → Svix raw-body HMAC verify (±5-min replay) → fetch message → forward with `reply_to`=sender. Idempotent DNS provision; route must be a `PUBLIC_PATHS` entry. | selftest ✓ |
| [`Webapp/transactional-email/`](Webapp/transactional-email/) | `sendEmail(to,subject,html,attachment?)` via the Resend REST API with recipient validation + fail-soft no-op. | selftest ✓ |
| [`Webapp/usage-quota/`](Webapp/usage-quota/) | Rolling-window usage limiter over any countable resource, with Pro + dev-allow-list exemptions; enforces at the action boundary. | selftest ✓ |
| [`Webapp/scheduled-runs/`](Webapp/scheduled-runs/) | Cadence model (once/weekly/monthly/custom-N) + owner-scoped `schedules` table + create/cancel actions. The n8n Schedule Trigger stays hosted. | selftest ✓ |
| [`Webapp/spend-gate/`](Webapp/spend-gate/) | Daily token/cost cap: `SECURITY DEFINER` `get_daily_token_spend()` RPC + a single pricing-truth module; the hosted gate node aborts over-cap. (Honest TE-5/Phase-4 gap: caps inert until token columns populated.) | selftest ✓ |
| [`Webapp/competitor-pricing-view/`](Webapp/competitor-pricing-view/) | **Display-only** read view of the latest competitor-pricing report. Scrape pipeline/schedule/structuring is hosted recurring IP and must not appear here — the boundary exemplar. | selftest ✓ |
| [`Webapp/password-hygiene/`](Webapp/password-hygiene/) | `checkPasswordStrength()` — rules + HaveIBeenPwned k-anonymity breach check (only the SHA-1 prefix leaves the box); fails open. Zero config. | selftest ✓ |
| [`Webapp/consent-log/`](Webapp/consent-log/) | Server-enforced GDPR signup consent gate + server-write-only `consent_accepted_at`/`consent_version` columns. | selftest ✓ |
| [`Webapp/activity-feed/`](Webapp/activity-feed/) | Per-user in-app audit trail: one `logEvent()` seam + owner-read / server-insert `activity_events` table. *(New seam — a refactor of Tessera's inline writes.)* | selftest ✓ |
| [`Webapp/stripe-billing/`](Webapp/stripe-billing/) | Stripe subscription lifecycle: signed webhook → idempotent absolute-state mirror into `profiles` + checkout/portal helpers; billing columns server-write-only. | ⚠️ **NOT live-wired / untested** — offline core only |

## `supabase/` — schema templates

Reusable Supabase **schema templates** — one idempotent RLS migration per
[`packages/db`](https://github.com/4R1U5-RCL/studio) §8.1 data shape, distilled
into client-agnostic `tmpl_*` DDL. **Boundary:** only the three §8.1 shapes (app
data Shopify doesn't own / a short-lived cache reconciled to Shopify / derived
history) — **never** a mirror of Shopify's live commercial state. RLS-by-default +
REVOKE discipline are baked into every table. Studio-ops reference schema, never
copied into a client repo.

Authored as code in the studio monorepo (`@studio/supabase-templates` primitives +
the harness `supabase-template` app-class) and provisioned to the
`studio/templates` project (`uzedswjxbgiuymleteud`); this dir is the published,
importable snapshot. See [`supabase/README.md`](supabase/README.md).

| Template | Shape | Pattern |
|----------|-------|---------|
| [`public-capture`](supabase/templates/public-capture.sql) | app data | `anon` insert-only / `service_role` read; PII columns REVOKEd. The permission-leak guard. |
| [`per-user-owned`](supabase/templates/per-user-owned.sql) | app data | RLS scoped to `auth.uid() = user_id`; `service_role` full. |
| [`child-owned-via-parent`](supabase/templates/child-owned-via-parent.sql) | app data | Transitive ownership: child rows scoped via `EXISTS` over the owned parent (two tables). |
| [`server-write-only-lock`](supabase/templates/server-write-only-lock.sql) | app data | Per-user row with locked (`plan`/billing) columns — `UPDATE` REVOKEd from owner; server-write-only. |
| [`shopify-cache`](supabase/templates/shopify-cache.sql) | cache | Short-lived, deliberately-stale, `service_role`-only; reconciled to Shopify — **never** a mirror. |
| [`derived-history`](supabase/templates/derived-history.sql) | derived history | Append-only snapshots; `service_role` insert / `authenticated` read. Net-new data Shopify doesn't retain. |

## Conventions

- **Self-contained.** A package lives entirely under its own directory; nothing it
  needs sits elsewhere in the tree.
- **Pinned consumption.** Consumers pull a tagged version and reference it in
  place. Bump the pin deliberately. (The first tag is `v0.1.0`.)
- **Earned green.** Every package's `selftest.mjs` proves real behaviour (negative
  controls fire); a pass is never "ran without error". One exception is flagged
  above: `stripe-billing` is offline-proven but **not yet tested against live APIs**.
