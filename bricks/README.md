# bricks/ — the assembly view

`components/` is the **layer view** — the source-of-truth library of parts, grouped
by technology layer (`Claude/`, `Webapp/`, `n8n/`, `supabase/`). `bricks/` is the
orthogonal **assembly view**: one folder per case-study brick, gathering the
components that compose it wherever they live in the layer tree.

Each brick folder holds:

- **`brick.json`** — the MANIFEST and single source of truth: the brick's name,
  plugin tag, kind (`BASE` / `ADD-ON`), the list of `components/` paths it composes,
  and a `planned[]` array for not-yet-built components.
- **`README.md`** — the case-study narrative + a table of components with their role.
- **`components/`** — MATERIALISED copies of the listed components (vendored so the
  brick folder is self-contained), plus a `.brick-lock.json` content-hash lock.

## The freshness mechanism (no drift)

The materialised copies are **generated**, never hand-edited. Two scripts keep the
assembly view honest against the layer view:

- `node scripts/assemble-bricks.mjs` — reads every `brick.json` and copies each
  listed component from `components/<path>` into `bricks/<brick>/components/<path>`,
  then writes `.brick-lock.json`. Idempotent. Run it after editing any component or
  manifest, and commit the result.
- `node scripts/check-brick-freshness.mjs` — the CI gate
  (`.github/workflows/brick-freshness.yml`, on push + PR): re-assembles into a temp
  dir and fails if any committed brick folder differs from what its manifest + the
  current `components/` would produce. A component edited without re-assembling its
  bricks fails CI with the exact stale paths.

Shared components (e.g. `signed-webhook-base`, `spend-gate`, `notification-fanout`)
live ONCE under `components/` and are listed in — and copied into — every brick that
uses them. That duplication is deliberate: it makes each brick self-contained, and
the freshness check makes it safe.

## The bricks

| Brick | Plugin | Kind | Status |
|---|---|---|---|
| [`sms-lead-qualifier/`](sms-lead-qualifier/) | `[sms_plugin]` | BASE | built |
| [`email-lead-qualifier/`](email-lead-qualifier/) | `[email_plugin]` | BASE | built |
| [`llm-lead-enrichment/`](llm-lead-enrichment/) | `[llmenri_plugin]` | ADD-ON | built |
| [`community-lead-radar/`](community-lead-radar/) | `[dirnotif_plugin]` | BASE | built |
| [`seo-improver/`](seo-improver/) | `[seo_improver_plugin]` / `[seo_pr_apply]` | BASE | **placeholder — In Build** (core components in `planned[]`) |

*Tessera is a full-stack project, not a `[*_plugin]` brick, and is intentionally
excluded from `bricks/`.*
