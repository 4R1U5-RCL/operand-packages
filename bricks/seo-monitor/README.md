# seo-monitor — `[seo_monitor_plugin]` (BASE brick)

SEO-suite brick #5, the SEO health monitor — a schedule-driven change/regression
detector (siblings: seo-improver, technical-audit). A schedule-triggered n8n
system: on a cadence, spend-guard the crawl, Firecrawl the monitored URLs, read
the prior snapshot, diff the on-page/indexability signals, classify each change
into a stable-ID event (indexability / robots / canonical / status / title / meta
/ sitemap), write the new snapshot + any change events back, and alert the owner
only when something actually moved. Every event's before/after traces to a real
snapshot row — no snapshot means an honest first-run baseline, never a fabricated
change. Not webhook-triggered: no inbound HMAC gate, no 401 branch — the schedule
is the trigger and the only signed surface is the outbound notify.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/seo-monitor.json` | The brick's own workflow: schedule → Confirm Config → spend guard → Firecrawl crawl of the monitored URLs (object-first, honest-empty) → read prior snapshot → diff → classify stable-ID change events → UPSERT snapshot + events ledgers → alert only on real movement via signed notify. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered Firecrawl crawl — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, technical-audit, content-tracker, competitor-gap, seo-improver, seo-audit-orchestrator.)* |
| `supabase/templates/seo-monitor.sql` | The brick-exclusive PAIR — `tmpl_seo_monitor_snapshots` (per-URL diff baseline, `on_conflict (tenant, url, run_date)`) + `tmpl_seo_monitor_events` (classified change events, `on_conflict (tenant, event_id, run_date)`). Both service-role-only, idempotent per run day. |
