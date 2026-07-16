# Changelog

## v0.2.0 — 2026-07-16

Repo restructured into a two-view layout: **`components/`** (the layer view —
source of truth for the parts, keeping the `Claude/` / `Webapp/` / `n8n/` /
`supabase/` subgrouping) + **`bricks/`** (the assembly view — one self-contained
folder per case-study brick, holding a `brick.json` manifest, a README, and
materialised copies of the components that compose it). A new freshness CI check
(`scripts/check-brick-freshness.mjs`, wired in `.github/workflows/brick-freshness.yml`)
fails if any brick folder drifts from the source-of-truth `components/` tree.

**Consumers on old pinned tags keep resolving the old tree** — a `v0.1.0` pin still
points at the pre-restructure top-level `Claude/`, `Webapp/`, `n8n/`, `supabase/`
paths. Only new pulls (`v0.2.0`+) see the `components/` prefix. Repoint any config
that references `operand-packages/{Claude,Webapp,n8n,supabase}/…` to
`operand-packages/components/{…}` before bumping the pin.

Also in this release:
- `.gitignore` audit-artifact patterns de-anchored (`**/audit/**/*.report.json`,
  `**/audit/.runtime/`) so runtime artifacts stay ignored under the new
  `components/Claude/audit/` location and in assembled brick mirrors.
- `nightly-sweep.yml` repointed to `components/Claude/ops-agents/…`.
- `Claude/README.md` grid gains the missing `verify-rotation` row (pre-existing
  doc drift, fixed).

## v0.1.0

Initial published snapshot of the reusable studio tooling: `Claude/` agent tooling,
`Webapp/` feature-packages, `n8n/` workflow templates, `supabase/` schema templates.
