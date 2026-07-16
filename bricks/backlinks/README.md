# backlinks — `[backlinks_plugin]` (BASE brick)

SEO-suite brick #6, the backlink-profile + link-gap finder. A webhook-triggered
(and optionally weekly-scheduled) n8n system: verify the signed request, ack
fast, then work behind the ack — pull the target's DataForSEO backlink summary
(authority + toxic/broken signals), its top referring domains and notable
anchors, and — when competitors are supplied — the link gaps (referring domains
that link to a rival but not to the target). Every finding is assembled into a
stable-ID row grounded on the DataForSEO fact, prioritized through a fail-open
LLM seam, and written to a grounded findings ledger before pinging the owner.
An empty/errored/unauthorized pull is recorded honestly, never a fabricated
link. The metered Backlinks API is bounded by the shared daily spend gate. A
base brick the SEO-audit orchestrator can compose.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/backlinks.json` | The brick's own workflow: webhook + weekly schedule → dual HMAC verify → 401 gate → signed 202 ack → spend guard → DataForSEO Backlinks summary + referring_domains + domain_intersection link gaps (object-first, honest-empty) → stable `LINK-<hex>` finding ids → fail-open LLM (`executeWorkflow` Prioritize Opportunities) → UPSERT the backlink-findings ledger → signed notify. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered DataForSEO Backlinks pulls — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, technical-audit, content-tracker, competitor-gap, content-gen, seo-improver, seo-audit-orchestrator.)* |
| `supabase/templates/backlinks.sql` | The brick-exclusive `tmpl_seo_backlink_findings` ledger — grounded referring-domain / link-gap / authority / anchor / toxic findings, service-role-only, `on_conflict (tenant, finding_id, run_date)` for idempotent re-runs. |
