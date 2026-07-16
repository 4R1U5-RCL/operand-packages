# supabase — schema templates

Reusable Supabase **schema templates** for the studio's own provisioning — a
layer under `components/`, sibling to [`Claude/`](../Claude/),
[`Webapp/`](../Webapp/) and [`n8n/`](../n8n/). Each template is one idempotent SQL migration realising a
single [`packages/db`](https://github.com/4R1U5-RCL/studio) §8.1 data shape,
distilled into client-agnostic DDL — the starting point and reference shape for
schema on a new project.

**Boundary — the §8.1 three shapes only.** Supabase holds three shapes, the same
for every client: (1) **app data** Shopify doesn't own, (2) a short-lived
**cache** reconciled to Shopify, (3) **derived history** Shopify doesn't retain.
These templates encode only those three and **never model a mirror** of Shopify's
live order/stock/payment state as a source of truth. Like `n8n/`, this is
studio-ops reference infra — it is never copied into a client-delivered repo.

These are **templates, not a live schema**: tables are generic `tmpl_*` slots in
the `public` schema with no client values and no secrets. Every template is
**idempotent** (`create table if not exists`; `drop policy if exists` then
`create policy`) so it re-applies cleanly.

> Source of truth: applied to the studio's `studio/templates` Supabase project
> (ref `<SUPABASE_TEMPLATES_REF redacted>`). Authored as code in the studio monorepo
> (`@studio/supabase-templates` primitives + `clients/_supabase-templates/sql/`
> builders) and built/verified/provisioned through the harness `supabase-template`
> app-class — never hand-written. This dir is the published, importable snapshot.

## Templates

| File | Shape | Pattern |
|------|-------|---------|
| [`templates/public-capture.sql`](templates/public-capture.sql) | (1) app data | Public capture table (leads / form / SEO). `anon` may **insert** but can **never read back**; only `service_role` reads server-side. PII columns (`email`, `phone`) column-REVOKEd. The canonical permission-leak guard (Tessera DEFECT-1 class). |
| [`templates/per-user-owned.sql`](templates/per-user-owned.sql) | (1) app data | Per-user owned table (dashboard-state / requests). RLS scopes all access to `auth.uid() = user_id`; `service_role` full. |
| [`templates/child-owned-via-parent.sql`](templates/child-owned-via-parent.sql) | (1) app data | Transitive ownership (documents-under-requests). A per-user **parent** + a **child** whose select policy scopes rows via `EXISTS` over the owned parent. Creates two tables. |
| [`templates/server-write-only-lock.sql`](templates/server-write-only-lock.sql) | (1) app data | Per-user table with **server-write-only** columns (e.g. `plan`/billing): owner reads/inserts/updates the row but `UPDATE` on the locked columns is REVOKEd from `anon`+`authenticated` — only `service_role`/the billing webhook writes them. |
| [`templates/shopify-cache.sql`](templates/shopify-cache.sql) | (2) cache | Short-lived, deliberately-stale cache row (`ttl_seconds`/`fetched_at`), `service_role`-only. **Not a source of truth** — a miss re-fetches from Shopify, never "trust the cache". |
| [`templates/derived-history.sql`](templates/derived-history.sql) | (3) derived history | Append-only point-in-time snapshots (stock-history). `service_role` inserts, `authenticated` reads to draw trends; `anon` never touches it. Net-new data Shopify doesn't retain — never a live mirror. |
| [`templates/keyword-research.sql`](templates/keyword-research.sql) | (1) app data | `tmpl_seo_keyword_research` — grounded keyword ledger for the `[keyword_research_plugin]` brick. Server-write-only (RLS on, REVOKE ALL from anon/public, `service_role` policy only); no public read surface. |
| [`templates/technical-audit.sql`](templates/technical-audit.sql) | (1) app data | `tmpl_seo_technical_findings` — grounded technical-findings ledger for the `[technical_audit_plugin]` brick. Server-write-only; no public read surface. |
| [`templates/seo-rank-snapshots.sql`](templates/seo-rank-snapshots.sql) | (3) derived history | `tmpl_seo_rank_snapshots` — append point-in-time ranks (D-1) for the `[seo_improver_plugin]` rank tracker. Server-write-only. |
| [`templates/seo-findings.sql`](templates/seo-findings.sql) | (1) app data | `tmpl_seo_findings` — stable-ID SEO opportunities ledger (D-2) for the `[seo_improver_plugin]` brick (`pr_url` null until Phase-2 fills it). Server-write-only. |
| [`templates/seo-audit-runs.sql`](templates/seo-audit-runs.sql) | (1) app data | The `[seo_audit_orchestrator_plugin]` brick's isolated PAIR — `tmpl_seo_audit_runs` (one row per run, `child_status` honesty record) + `tmpl_seo_audit_queue` (one row per prioritized task, `merged_from` dedup trail). Server-write-only; no public read surface. |
| [`templates/content-tracker.sql`](templates/content-tracker.sql) | (1) app data | `tmpl_seo_content_findings` — grounded content / on-page findings ledger for the `[content_tracker_plugin]` brick. Server-write-only; `on_conflict (tenant, finding_id, run_date)`; no public read surface. |
| [`templates/competitor-gap.sql`](templates/competitor-gap.sql) | (1) app data | `tmpl_seo_competitor_gaps` — grounded competitor / SERP gaps ledger for the `[competitor_gap_plugin]` brick. Server-write-only; `on_conflict (tenant, finding_id, run_date)`; no public read surface. |
| [`templates/seo-monitor.sql`](templates/seo-monitor.sql) | (3) derived history | The `[seo_monitor_plugin]` brick's isolated PAIR — `tmpl_seo_monitor_snapshots` (per-URL diff baseline) + `tmpl_seo_monitor_events` (classified change events). Append point-in-time history; server-write-only; no public read surface. |
| [`templates/backlinks.sql`](templates/backlinks.sql) | (1) app data | `tmpl_seo_backlink_findings` — grounded referring-domain / link-gap / authority ledger for the `[backlinks_plugin]` brick. Server-write-only; `on_conflict (tenant, finding_id, run_date)`; no public read surface. |
| [`templates/content-gen.sql`](templates/content-gen.sql) | (1) app data | `tmpl_seo_content_briefs` — DRAFT-FIRST SERP-grounded content-brief ledger for the `[content_gen_plugin]` brick. Server-write-only; `on_conflict (tenant, brief_id, run_date)`; no public read surface. |

Sixteen templates create **nineteen tables** (`child-owned-via-parent`,
`seo-audit-runs` and `seo-monitor` each create two).

## Conventions baked into every template

- **RLS by default, no exceptions.** Every table ships `enable row level security`
  **and** at least one policy, `revoke all` from `anon`/`public` first, and is
  **never** granted `anon` SELECT — no world-readable table.
- **REVOKE discipline travels with the table.** Sensitive/PII columns get a
  column-level `REVOKE SELECT`; server-write-only columns get a column-level
  `REVOKE UPDATE` from `anon`+`authenticated`. The lock-down is part of the shape.
- **No secrets, no client values.** Schema/table/column names are validated plain
  SQL identifier **slots** (`public` / generic `tmpl_*`); no business name, no
  connection string, no key is ever baked into a statement.
- **Idempotent by construction.** `create table if not exists`; `drop policy if
  exists` then `create policy`; `create index if not exists`. Re-applies cleanly.
- **Boundary.** Only the three §8.1 shapes; no template models a Shopify mirror.

## Using a template

1. Apply the `.sql` to a target project — `POST
   /v1/projects/{ref}/database/query` (the studio Management-API transport), or
   paste into the Supabase SQL editor.
2. Rename the `tmpl_*` table slot to your real table (and adjust the body columns /
   `public` schema as needed); the RLS + REVOKE scaffolding carries over unchanged.
3. Re-running is safe — the migration is idempotent.

To regenerate this snapshot, re-run the harness `supabase-template` build (it
provisions the same definitions to `studio/templates` idempotently) or re-emit the
`clients/_supabase-templates/sql/` builders.
