# reporting-digest — `[reporting_digest_plugin]` (BASE brick)

SEO-suite wave-4 brick, the recurring **digest** over the SEO audit output. A
scheduled n8n system with no external metered pull: on a weekly cron it reads
the SEO-audit orchestrator's latest run and its prioritized work-queue
(`tmpl_seo_audit_runs` / `tmpl_seo_audit_queue`), guards against re-sending the
same period, assembles a deterministic exec-summary from the facts, runs them
through a fail-open LLM summarize seam (`executeWorkflow` — a bare, functional
digest still ships when no model is bound), composes the report, and pings the
owner over the signed notify seam. Every delivered report is stamped into its
own `tmpl_seo_report_log` ledger — the dedup guard and the audit trail. It is a
pure **reader** over another brick's output: no spend gate, no DataForSEO /
Firecrawl call, nothing metered. A base brick the owner turns on once the
orchestrator is running.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/reporting-digest.json` | The brick's own workflow: weekly schedule → read prior report-log → fresh-period dedup guard → read the orchestrator's latest run + prioritized queue (object-first, honest-empty) → deterministic exec-summary facts → fail-open LLM (`executeWorkflow` Summarize) → compose digest → signed notify → stamp + UPSERT the report-log ledger. No webhook, no ack, no spend guard — nothing metered. |
| `supabase/templates/seo-audit-runs.sql` | The orchestrator's `tmpl_seo_audit_runs` + `tmpl_seo_audit_queue` PAIR — the tables this digest **reads** (never writes). *(SHARED with seo-audit-orchestrator, which owns/writes them.)* |
| `supabase/templates/reporting-digest.sql` | The brick-exclusive `tmpl_seo_report_log` ledger — one row per delivered digest, the fresh-period dedup guard and delivery audit trail. Server-write-only; no public read surface. |
