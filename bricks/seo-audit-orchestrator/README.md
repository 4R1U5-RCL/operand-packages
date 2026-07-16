# seo-audit-orchestrator — `[seo_audit_orchestrator_plugin]` (BASE brick)

The SEO-suite **goal endpoint**: one webhook-triggered orchestrator that composes
the child SEO bricks — keyword-research, technical-audit, and the seo-improver
rank-tracker — into a single deduped, prioritized work-queue. Verify the signed
request, ack fast, then behind the ack dispatch each child via `executeWorkflow`
(one child failing does not sink the audit), read each child ledger, normalize to
a shared finding schema, dedup across bricks, rank by impact × low-effort, and
write two isolated ledgers (the run record + the work-queue) before pinging the
owner with the top-N. Grounding is strict: every queued task traces to ≥1 real
child finding, and a child that returned nothing / errored / was excluded is
recorded honestly in `child_status`, never fabricated.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/seo-audit-orchestrator.json` | The orchestrator workflow: webhook → dual HMAC verify → 401 gate → signed 202 ack → `executeWorkflow` dispatch to the child bricks (`continueRegularOutput`) → read each child ledger → normalize → dedup (`merged_from` = source finding_ids × brick) → prioritize → fail-open LLM exec-summary → UPSERT the two isolated ledgers → signed top-N notify. |
| `n8n/workflows/keyword-research.json` | Child brick #1 dispatched + read by the orchestrator. *(SHARED with keyword-research.)* |
| `n8n/workflows/technical-audit.json` | Child brick #2 dispatched + read by the orchestrator. *(SHARED with technical-audit.)* |
| `n8n/workflows/seo-improver.json` | Child rank-tracker brick dispatched + read by the orchestrator. *(SHARED with seo-improver.)* |
| `Webapp/spend-gate` | Hard daily spend cap on the metered pulls — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, technical-audit, seo-improver.)* |
| `supabase/templates/seo-audit-runs.sql` | The brick-exclusive pair — `tmpl_seo_audit_runs` (one row per run, `child_status` honesty record) + `tmpl_seo_audit_queue` (one row per prioritized task, `merged_from` dedup/grounding trail). Server-write-only; no public read surface. |
| `supabase/templates/keyword-research.sql` | Child ledger the orchestrator READS (`tmpl_seo_keyword_research`). *(SHARED with keyword-research.)* |
| `supabase/templates/technical-audit.sql` | Child ledger the orchestrator READS (`tmpl_seo_technical_findings`). *(SHARED with technical-audit.)* |
| `supabase/templates/seo-findings.sql` | Child ledger the orchestrator READS (`tmpl_seo_findings`, the seo-improver rank-tracker). *(SHARED with seo-improver.)* |
