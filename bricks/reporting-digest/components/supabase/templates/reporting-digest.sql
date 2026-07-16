-- =============================================================================
-- TEMPLATE reporting-digest — [TEMPLATE] SEO reporting digest log ([reporting_digest_plugin] brick, run ledger + dedup guard, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [reporting_digest_plugin] run ledger (app data Shopify does not own, §8.1

-- shape 1) — the SEO-suite #8 client-facing rollup. EXCLUSIVE to this brick. It READS

-- tmpl_seo_audit_queue + tmpl_seo_audit_runs and WRITES only this table. source_facts is

-- the grounding evidence — every report figure/action traces to a real audit row. UNIQUE

-- (tenant, period_start, period_end) is the DEDUP GUARD: one report per tenant per period,

-- the upsert conflict target so a cron re-fire never double-sends. Server-write-only

-- TABLE-WIDE (no public read surface).

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_report_log" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null,
  "period_start" timestamptz not null,
  "period_end" timestamptz not null,
  "sent_at" timestamptz,
  "status" text not null default 'pending' check (status in ('pending','sent','no_data','error')),
  "report_summary" text,
  "source_facts" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_report_log_tenant_period_uidx" on "public"."tmpl_seo_report_log" ("tenant", "period_start", "period_end");

create index if not exists "tmpl_seo_report_log_tenant_period_idx" on "public"."tmpl_seo_report_log" ("tenant", "period_start" desc);

alter table "public"."tmpl_seo_report_log" enable row level security;

revoke all on "public"."tmpl_seo_report_log" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_report_log" to service_role;

drop policy if exists "tmpl_seo_report_log_service_all" on "public"."tmpl_seo_report_log";
create policy "tmpl_seo_report_log_service_all"
  on "public"."tmpl_seo_report_log" for all
  to service_role
  using (true)
  with check (true);
