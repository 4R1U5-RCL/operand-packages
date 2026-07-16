# seo-improver — `[seo_improver_plugin]` / `[seo_pr_apply]` (BASE brick — Phase-1 built)

The Phase-1 detection base is **built**: a weekly grounded rank monitor that
measures where a site's pages actually rank via DataForSEO, computes
week-over-week movement, and surfaces a small set of high-leverage opportunities
through deterministic heuristics (SEO-STRIKE / SEO-CANN / SEO-DECAY) with a
fail-open change-drafting seam. Detection is automated and grounded — every
finding carries ranking evidence and a stable id; nothing is fabricated when the
pull is empty or a model isn't bound. The Phase-2 `[seo_pr_apply]` brick that
turns findings into reviewable pull requests is still in build (see `planned[]`).
Full design: `SPEC_operand-seo-improver_2026-07-16.md`.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/seo-improver.json` | The brick's own detection workflow: weekly schedule → Confirm Config → spend guard → DataForSEO ranked-keywords pull (object-first, honest-empty) → compute WoW movement against prior snapshots → deterministic heuristics with stable finding ids → fail-open LLM change-drafting seam → UPSERT rank snapshots + findings → signed `[STUDIO_NOTIFICATIONS]` digest. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered DataForSEO pull — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, technical-audit, seo-audit-orchestrator.)* |
| `supabase/templates/seo-rank-snapshots.sql` | The brick-exclusive `tmpl_seo_rank_snapshots` table (D-1) — append point-in-time ranks, `on_conflict (tenant, keyword, locale, device, run_date)`. |
| `supabase/templates/seo-findings.sql` | The brick-exclusive `tmpl_seo_findings` table (D-2) — stable-ID opportunities, `on_conflict (tenant, finding_id)`; `pr_url` stays null (Phase-2 owns it). |

## Planned components (Phase 2 — not yet in the repo)

See `planned[]` in [`brick.json`](brick.json):

- `[seo_pr_apply]` ops-agent + agent-kit guard extension — the harness-driven apply brick.
- `GSC_MINT_JS` emitted-JS helper — deferred (DataForSEO-first flip).
