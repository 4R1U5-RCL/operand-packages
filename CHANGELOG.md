# Changelog

## Unreleased — 2026-07-16 (brick wave + SEO suite export)

Curatorial export of a brick wave + the eight-brick SEO suite into the two-view
layout, mirroring the `seo-improver` placeholder convention (shared generic
components + a rich `planned[]` for the not-yet-snapshotted core).

- **New wave bricks:** `telegram-triage` (`[triage_plugin]`, ADD-ON, reusable
  verdict layer, owns no table), `content-wall` (`[content_wall_plugin]`, BASE,
  generalizes Vouch), `scheduled-digest` (`[scheduled_digest]`, BASE, public:
  Digest).
- **Eight SEO bricks** (each its own plugin, not one suite folder):
  `keyword-research`, `technical-audit`, `seo-audit-orchestrator` (ADD-ON,
  composing), `content-tracker`, `competitor-gap`, `seo-monitor`, `backlinks`,
  `content-gen`.
- **Three new generic components** (genuine reusable shapes the library lacked):
  `n8n/workflows/source-monitor-poller.json` (durable-cursor ingest engine,
  extracted from the Radar scraper base; consumed by `seo-monitor`),
  `supabase/templates/security-barrier-view.sql` (tenant-scoped public-READ
  barrier view — the content-wall publish shape),
  `supabase/templates/idempotent-run-log.sql` (per-`(client_id, period_key)` send
  ledger with a UNIQUE exactly-once arbiter — the scheduled-digest send-log shape).
  All `active:false`, creds-stripped, generic.
- **Updated bricks:** `llm-lead-enrichment` (additive `return_partial` mode +
  `scoringProfile` param, both non-breaking) and `community-lead-radar`
  (source-monitor engine extraction reflected).
- `assemble-bricks.mjs` + `check-brick-freshness.mjs` re-run green across all 16
  bricks.

## v0.5.0 — 2026-07-16

Repo restructured into a two-view layout: **`components/`** (the layer view —
source of truth for the parts, keeping the `Claude/` / `Webapp/` / `n8n/` /
`supabase/` subgrouping) + **`bricks/`** (the assembly view — one self-contained
folder per case-study brick, holding a `brick.json` manifest, a README, and
materialised copies of the components that compose it). A new freshness CI check
(`scripts/check-brick-freshness.mjs`, wired in `.github/workflows/brick-freshness.yml`)
fails if any brick folder drifts from the source-of-truth `components/` tree.

**Consumers on old pinned tags keep resolving the old tree** — a `v0.4.0` (or
earlier) pin still points at the pre-restructure top-level `Claude/`, `Webapp/`,
`n8n/`, `supabase/` paths. Only new pulls (`v0.5.0`+) see the `components/` prefix.
Repoint any config that references `operand-packages/{Claude,Webapp,n8n,supabase}/…`
to `operand-packages/components/{…}` before bumping the pin.

Also in this release:
- `.gitignore` audit-artifact patterns de-anchored (`**/audit/**/*.report.json`,
  `**/audit/.runtime/`) so runtime artifacts stay ignored under the new
  `components/Claude/audit/` location and in assembled brick mirrors.
- `nightly-sweep.yml` repointed to `components/Claude/ops-agents/…`.
- `Claude/README.md` grid gains the missing `verify-rotation` row (pre-existing
  doc drift, fixed).

## v0.1.0 – v0.4.0

Pre-restructure history (top-level `Claude/` / `Webapp/` / `n8n/` / `supabase/`
layout) — see the GitHub Releases page for details. Notably `v0.4.0` = the
`Claude/` + `Webapp/` regrouping and 11 `Webapp` packages.
