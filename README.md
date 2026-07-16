# packages — reusable studio tooling

Standalone, reusable tooling that serves the studio but isn't part of any single
client build or the harness. Each package is self-contained and is **consumed by
pulling a pinned version**, never copy-forked into a container.

## Two views: `components/` ⟂ `bricks/`

The repo is organised along **two orthogonal axes**:

- **[`components/`](components/) — the LAYER view (source of truth for the parts).**
  Every reusable part, grouped by technology layer: [`Claude/`](components/Claude/)
  agent tooling, [`Webapp/`](components/Webapp/) feature-packages,
  [`n8n/`](components/n8n/) workflow templates, [`supabase/`](components/supabase/)
  schema templates. This is where a component is edited.
- **[`bricks/`](bricks/) — the ASSEMBLY view (which parts make which product).**
  One folder per case-study brick, gathering the components that compose it wherever
  they live in the layer tree. Each brick folder is self-contained: it holds a
  `brick.json` manifest, a README, and MATERIALISED copies of its components.

The two stay honest via a **freshness check**: `bricks/*/components/` are generated
copies, and `.github/workflows/brick-freshness.yml` fails CI if any brick drifts
from the source-of-truth `components/` tree. See [`bricks/README.md`](bricks/README.md)
and the [Freshness](#freshness-no-drift) section below.

## `components/` layout

- **[`components/Claude/`](components/Claude/)** — agent-side tooling for the studio:
  5 code packages + 10 prompt skills (see
  [`components/Claude/README.md`](components/Claude/README.md)).
- **[`components/Webapp/`](components/Webapp/)** — reusable web-app feature-packages
  extracted from Tessera (11 packages — see
  [`components/Webapp/README.md`](components/Webapp/README.md)).
- **[`components/n8n/`](components/n8n/)** — hosted n8n workflow **templates** (10
  importable workflow definitions for the studio's own instance — see
  [`components/n8n/README.md`](components/n8n/README.md)).
- **[`components/supabase/`](components/supabase/)** — reusable Supabase **schema
  templates** (6 idempotent RLS migrations / 7 tables for the §8.1 data shapes — see
  [`components/supabase/README.md`](components/supabase/README.md)).

## `components/Claude/` — agent-side tooling

Two shapes, each a subfolder with a `SKILL.md` entry point — **code packages**
(deterministic check core + CI/scheduled callers) and **prompt skills**
(pure-prompt slash-commands, each folding a `PAT-*` error class into a blocking
preflight). Full index in [`Claude/README.md`](components/Claude/README.md); the skill grid
(args + guardrail each encodes) is in
[`Claude/SKILLS-CHEATSHEET.md`](components/Claude/SKILLS-CHEATSHEET.md).

| Code package | What it is |
|--------------|------------|
| [`Claude/audit/`](components/Claude/audit/) | ATT&CK × ISO 27001 × SOC 2 security verification for the studio stack — a deterministic check core with three entry points (agent skill, CI gate, scheduled runner). Every check is self-guarded so a pass is earned, never assumed. |
| [`Claude/hygiene/`](components/Claude/hygiene/) | Config/codebase hygiene across three pluggable profiles (`claude` home-tree relocation, `codebase` git-aware backup + junk-drift report, `llm-artifacts` transcript backup). `cleanup` drift detector + self-verifying `backup`; report-only on non-`claude` profiles. Self-guarded so a pass is earned. |
| [`Claude/consult/`](components/Claude/consult/) | Multi-model cross-validation — `research` + `validate` over one LiteLLM chain (base → GPT-5 → Gemini, optional Perplexity). Self-guarded offline; a corroborated/HIGH verdict needs the tiers to have actually responded, else `unknown` — never a fabricated answer. |
| [`Claude/notify/`](components/Claude/notify/) | Claude Code → Telegram notifier. A `Notification`/`Stop` hook POSTs a signed event to the studio's hosted notifications n8n workflow, which pings Telegram (🟡 needs input / 🟢 done). Header-Auth + HMAC-signed; the live channel is proven via the n8n executions API. |
| [`Claude/ops-agents/`](components/Claude/ops-agents/) | Durable home for the scheduled **ops-agents** — read-only gatherers that sweep the estate (Dependabot PRs + per-repo audit signal) and emit a Telegram digest, **deferring every guarded write** to the main session. Dependency-free `.mjs` (vendored guard = faithful port of `@studio/agent-kit/guard`); dry-run is the default, `--apply` only ARMS the deferred plan, `--selftest` proves no guarded write escapes in-process. |

| Prompt skill | What it does |
|--------------|--------------|
| [`Claude/harness-app-class/`](components/Claude/harness-app-class/) | Scaffold a NEW harness app-class + wire every registration point so the pipeline recognizes it (Track A studio-ops template class vs Track B served-app class). |
| [`Claude/deploy-vercel/`](components/Claude/deploy-vercel/) | Take an already-built client app live on Vercel — confirms the real project ID, guards PAT-7/PAT-8. |
| [`Claude/db-migrate/`](components/Claude/db-migrate/) | Apply a Supabase migration over HTTPS (Management API) + verify the object landed AND every new table has RLS (PAT-5). |
| [`Claude/n8n-deploy/`](components/Claude/n8n-deploy/) | Push a workflow from `@studio/n8n-templates` to the hosted n8n instance (inactive by default); §8 boundary — never copies a definition into a client repo. |
| [`Claude/dependabot-triage/`](components/Claude/dependabot-triage/) | List, group, gate-on-CI, and batch-merge Dependabot PRs across 4R1U5-RCL (green patch/minor only; majors held). |
| [`Claude/ci-add-to-board/`](components/Claude/ci-add-to-board/) | Wire `actions/add-to-project` CI so new issues/PRs auto-add to a Projects board. |
| [`Claude/app-security-audit/`](components/Claude/app-security-audit/) | App-surface security audit (RLS + response headers + SCA) of a built client repo, via the `audit` package — upstream of the harness `verify` stage. |
| [`Claude/diagnose-secret/`](components/Claude/diagnose-secret/) | Diagnose a secret that looks right but 401s at runtime — narrows to one of the 4 PAT-11 causes; never echoes the value. |
| [`Claude/verify-rotation/`](components/Claude/verify-rotation/) | Post-rotation propagation check — runs the `secret-propagation` ops-agent on-demand against a named key (IN-13 container-fingerprint guard); presence-only verdicts, never values. Companion to `diagnose-secret`. |

## `Webapp/` — web-app feature-packages (from Tessera)

Self-contained, env-driven, HMAC + ≤5-min replay on every webhook seam, with an
offline `selftest.mjs` whose pass is earned. **Recurring boundary:** n8n workflow
*definitions* stay hosted; packages ship only the signed hook/route, a display
view, migrations, and a doc of the matching n8n node.

| Package | What it is | Status |
|---------|------------|--------|
| [`Webapp/n8n-trigger/`](components/Webapp/n8n-trigger/) | **Foundational** signed-webhook seam: server-only client firing a hosted n8n workflow (timestamped HMAC) + the inbound verifier. The pattern the other n8n features reuse. | selftest ✓ |
| [`Webapp/inbound-email/`](components/Webapp/inbound-email/) | Resend inbound webhook → Svix raw-body HMAC verify (±5-min replay) → fetch message → forward with `reply_to`=sender. Idempotent DNS provision; route must be a `PUBLIC_PATHS` entry. | selftest ✓ |
| [`Webapp/transactional-email/`](components/Webapp/transactional-email/) | `sendEmail(to,subject,html,attachment?)` via the Resend REST API with recipient validation + fail-soft no-op. | selftest ✓ |
| [`Webapp/usage-quota/`](components/Webapp/usage-quota/) | Rolling-window usage limiter over any countable resource, with Pro + dev-allow-list exemptions; enforces at the action boundary. | selftest ✓ |
| [`Webapp/scheduled-runs/`](components/Webapp/scheduled-runs/) | Cadence model (once/weekly/monthly/custom-N) + owner-scoped `schedules` table + create/cancel actions. The n8n Schedule Trigger stays hosted. | selftest ✓ |
| [`Webapp/spend-gate/`](components/Webapp/spend-gate/) | Daily token/cost cap: `SECURITY DEFINER` `get_daily_token_spend()` RPC + a single pricing-truth module; the hosted gate node aborts over-cap. (Honest TE-5/Phase-4 gap: caps inert until token columns populated.) | selftest ✓ |
| [`Webapp/competitor-pricing-view/`](components/Webapp/competitor-pricing-view/) | **Display-only** read view of the latest competitor-pricing report. Scrape pipeline/schedule/structuring is hosted recurring IP and must not appear here — the boundary exemplar. | selftest ✓ |
| [`Webapp/password-hygiene/`](components/Webapp/password-hygiene/) | `checkPasswordStrength()` — rules + HaveIBeenPwned k-anonymity breach check (only the SHA-1 prefix leaves the box); fails open. Zero config. | selftest ✓ |
| [`Webapp/consent-log/`](components/Webapp/consent-log/) | Server-enforced GDPR signup consent gate + server-write-only `consent_accepted_at`/`consent_version` columns. | selftest ✓ |
| [`Webapp/activity-feed/`](components/Webapp/activity-feed/) | Per-user in-app audit trail: one `logEvent()` seam + owner-read / server-insert `activity_events` table. *(New seam — a refactor of Tessera's inline writes.)* | selftest ✓ |
| [`Webapp/stripe-billing/`](components/Webapp/stripe-billing/) | Stripe subscription lifecycle: signed webhook → idempotent absolute-state mirror into `profiles` + checkout/portal helpers; billing columns server-write-only. | ⚠️ **NOT live-wired / untested** — offline core only |

## `n8n/` — hosted workflow templates

Reusable n8n workflow **templates** for the studio's OWN hosted instance —
importable node-graph definitions distilled from the studio's live hosted
workflows. **Boundary, the other side of `Webapp/`:** `Webapp/` ships only the
signed *hook/route* a client app uses to call a hosted workflow; `n8n/` is the
hosted *definitions* themselves — studio-ops recurring IP, never copied into a
client repo. Templates ship **inactive** with **unbound credential slots**;
binding creds + activating is a deliberate human/ops step.

Authored as code in the studio monorepo (`@studio/n8n-templates` primitives + the
harness `n8n-template` app-class) and provisioned to the studio's own hosted n8n
instance; this dir is the published, importable snapshot. See
[`n8n/README.md`](components/n8n/README.md).

| Template | Pattern |
|----------|---------|
| [`signed-webhook-base`](components/n8n/workflows/signed-webhook-base.json) | Base skeleton: webhook → dual-mode HMAC verify → 401 gate → fast ack → process → signed respond. |
| [`read-only-json-api`](components/n8n/workflows/read-only-json-api.json) | GET webhook → Supabase REST select → shape → respond. |
| [`notification-fanout`](components/n8n/workflows/notification-fanout.json) | verify → format → channel-parameterised delivery → respond after delivery. |
| [`schedule-dispatcher`](components/n8n/workflows/schedule-dispatcher.json) | cron → query due rows → manual filter → fire webhook → write-back. |
| [`llm-doc-pipeline-mono`](components/n8n/workflows/llm-doc-pipeline-mono.json) | analyse → map/scrape → combine → compose → store, with cost logging + spend guard (OpenRouter HTTP). |
| [`orchestrator-routing`](components/n8n/workflows/orchestrator-routing.json) | webhook → switch on type → `executeWorkflow` dispatch to children. |
| [`email-report`](components/n8n/workflows/email-report.json) | validate → compose → Resend `/emails` → log success/failure → respond. |
| [`outbound-verdict-callback`](components/n8n/workflows/outbound-verdict-callback.json) | push to external webapp → read verdict → map → re-enter pipeline. |
| [`shopify-webhook-reread`](components/n8n/workflows/shopify-webhook-reread.json) | Shopify HMAC verify → live re-read / cache invalidate → respond. **Never mirrors** commercial state. |
| [`sms-state-machine`](components/n8n/workflows/sms-state-machine.json) | inbound → STOP/dedupe guards → identity/session lookup → AI decision → outbound + provider flag. |

## `supabase/` — schema templates

Reusable Supabase **schema templates** — one idempotent RLS migration per
the studio monorepo's `packages/db` §8.1 data shape, distilled
into client-agnostic `tmpl_*` DDL. **Boundary:** only the three §8.1 shapes (app
data Shopify doesn't own / a short-lived cache reconciled to Shopify / derived
history) — **never** a mirror of Shopify's live commercial state. RLS-by-default +
REVOKE discipline are baked into every table. Studio-ops reference schema, never
copied into a client repo.

Authored as code in the studio monorepo (`@studio/supabase-templates` primitives +
the harness `supabase-template` app-class) and provisioned to the studio's own
hosted Supabase templates project; this dir is the published, importable
snapshot. See [`supabase/README.md`](components/supabase/README.md).

| Template | Shape | Pattern |
|----------|-------|---------|
| [`public-capture`](components/supabase/templates/public-capture.sql) | app data | `anon` insert-only / `service_role` read; PII columns REVOKEd. The permission-leak guard. |
| [`per-user-owned`](components/supabase/templates/per-user-owned.sql) | app data | RLS scoped to `auth.uid() = user_id`; `service_role` full. |
| [`child-owned-via-parent`](components/supabase/templates/child-owned-via-parent.sql) | app data | Transitive ownership: child rows scoped via `EXISTS` over the owned parent (two tables). |
| [`server-write-only-lock`](components/supabase/templates/server-write-only-lock.sql) | app data | Per-user row with locked (`plan`/billing) columns — `UPDATE` REVOKEd from owner; server-write-only. |
| [`shopify-cache`](components/supabase/templates/shopify-cache.sql) | cache | Short-lived, deliberately-stale, `service_role`-only; reconciled to Shopify — **never** a mirror. |
| [`derived-history`](components/supabase/templates/derived-history.sql) | derived history | Append-only snapshots; `service_role` insert / `authenticated` read. Net-new data Shopify doesn't retain. |

## `bricks/` — the assembly view

One folder per case-study brick, gathering the components that compose it. Each
brick folder is **self-contained** — a `brick.json` manifest (the source of truth),
a README, and MATERIALISED copies of its components under `bricks/<brick>/components/`.
Full index + shape in [`bricks/README.md`](bricks/README.md).

| Brick | Plugin | Kind | Status |
|---|---|---|---|
| [`sms-lead-qualifier/`](bricks/sms-lead-qualifier/) | `[sms_plugin]` | BASE | built |
| [`email-lead-qualifier/`](bricks/email-lead-qualifier/) | `[email_plugin]` | BASE | built |
| [`llm-lead-enrichment/`](bricks/llm-lead-enrichment/) | `[llmenri_plugin]` | ADD-ON | built |
| [`community-lead-radar/`](bricks/community-lead-radar/) | `[dirnotif_plugin]` | BASE | built |
| [`seo-improver/`](bricks/seo-improver/) | `[seo_improver_plugin]` / `[seo_pr_apply]` | BASE | **placeholder — In Build** |

*Tessera is a full-stack project, not a `[*_plugin]` brick — intentionally excluded.*

## Freshness (no drift)

The materialised brick copies are **generated**, never hand-edited, and a CI check
proves they never silently diverge from the source-of-truth `components/` tree:

- `node scripts/assemble-bricks.mjs` — reads every `brick.json` and copies each
  listed component from `components/<path>` into `bricks/<brick>/components/<path>`,
  then writes a `.brick-lock.json` content-hash lock. Idempotent; run after editing a
  component or manifest and commit the result. Audit runtime artifacts (`.runtime/`,
  `*.report.json`) are skipped, matching `.gitignore`.
- `node scripts/check-brick-freshness.mjs` — the CI entrypoint
  ([`.github/workflows/brick-freshness.yml`](.github/workflows/brick-freshness.yml),
  on push + PR): re-assembles into a temp dir and **fails with the exact stale paths**
  if any committed brick folder differs from what its manifest + the current
  `components/` would produce.

Shared components live ONCE under `components/` and are copied into every brick that
uses them; the duplication is deliberate (self-contained brick folders) and the check
makes it safe.

## Conventions

- **Self-contained.** A package lives entirely under its own directory; nothing it
  needs sits elsewhere in the tree. Brick folders are self-contained the same way —
  via vendored, freshness-checked copies.
- **Pinned consumption.** Consumers pull a tagged version and reference it in
  place. Bump the pin deliberately. `v0.2.0` restructured the repo into
  `components/` + `bricks/` — **consumers on old pinned tags (`v0.1.0`) keep
  resolving the old top-level tree**; only new pulls see the `components/` prefix.
  See [`CHANGELOG.md`](CHANGELOG.md).
- **Earned green.** Every package's `selftest.mjs` proves real behaviour (negative
  controls fire); a pass is never "ran without error". One exception is flagged
  above: `stripe-billing` is offline-proven but **not yet tested against live APIs**.
