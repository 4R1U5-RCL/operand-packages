# technical-audit — `[technical_audit_plugin]` (BASE brick)

SEO-suite brick #2, the technical site audit (Performance / Core Web Vitals
folded in). A schedule-triggered n8n system: pull DataForSEO on-page/instant-pages
findings plus PageSpeed Insights v5 for CWV, assemble them into stable-ID issues,
rank them through a fail-open LLM synthesis seam, and write a grounded findings
ledger back before pinging the owner. On a 401/error/empty pull the run records an
honest blocker rather than a fabricated finding. A base brick the SEO-audit
orchestrator composes.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/technical-audit.json` | The brick's own workflow: schedule → Confirm Config → spend guard → DataForSEO on-page pull (object-first, honest-empty) → PageSpeed CWV → assemble issues with stable `TECH-<class>-<n>` ids → fail-open LLM synthesis → UPSERT the findings ledger → signed notify. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered DataForSEO pull — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, seo-improver, seo-audit-orchestrator.)* |
| `supabase/templates/technical-audit.sql` | The brick-exclusive `tmpl_seo_technical_findings` ledger — grounded technical findings, service-role-only, `on_conflict (tenant, finding_id, run_date)` for idempotent re-runs. |
