# seo-improver — `[seo_improver_plugin]` / `[seo_pr_apply]` (PLACEHOLDER — In Build)

> **This brick is a DESIGN spec, not a built product.** Almost none of its core
> components exist in `operand-packages` today. This folder is a **placeholder**: it
> documents the spec and the existing components the brick will reuse, and lists the
> not-yet-built core artifacts in [`brick.json`](brick.json)'s `planned[]` array.
> It intentionally has **no assembled `components/` mirror** beyond the three
> existing shared components — the freshness check only materialises what exists.

A weekly grounded rank monitor: it measures where a site's pages actually rank via
DataForSEO, computes week-over-week movement, and surfaces a small set of
high-leverage opportunities — deterministic detection, drafted wording, findings
turned into reviewable pull requests a human merges. A detection base and the apply
brick that acts on it. Full design: `SPEC_operand-seo-improver_2026-07-16.md`.

## Existing components it will reuse

| Component | Role |
|---|---|
| `n8n/workflows/schedule-dispatcher.json` | Weekly cron → pull → movement → findings (mirrors the analytics-digest cron shape). *(SHARED with community-lead-radar.)* |
| `n8n/workflows/notification-fanout.json` | Signed `[STUDIO_NOTIFICATIONS]` report digest (W-12). *(SHARED with community-lead-radar.)* |
| `Webapp/spend-gate` | DataForSEO is paid/metered → spend guard (durable counter). *(SHARED with llm-lead-enrichment, community-lead-radar.)* |

## Planned components (do NOT exist in the repo yet)

See `planned[]` in [`brick.json`](brick.json):

- `[seo_improver_plugin]` n8n workflow builder — the DataForSEO detection workflow.
- `tmpl_seo_rank_snapshots` SQL (D-1) — brick-exclusive rank-snapshot table.
- `tmpl_seo_findings` SQL (D-2) — brick-exclusive findings table.
- `[seo_pr_apply]` ops-agent + agent-kit guard extension — Phase-2 apply brick.
- `GSC_MINT_JS` emitted-JS helper — deferred (DataForSEO-first flip).
