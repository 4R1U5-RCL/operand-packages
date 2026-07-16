-- =============================================================================
-- TEMPLATE seo-rank-snapshots — [TEMPLATE] SEO rank snapshots ([seo_improver_plugin] brick, derived ranking ledger, service-role-only)
-- §8.1 shape (3): DERIVED HISTORY — net-new snapshots, NOT a live mirror.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [seo_improver_plugin] ranking ledger (derived history, §8.1 shape 3),

-- EXCLUSIVE to the brick. Every finding's position figure traces to a row here (grounding

-- discipline). v1 data source = DataForSEO; clicks/impressions/ctr are NULLable, populated

-- later by GSC. UNIQUE (tenant, keyword, locale, device, run_date) is the UPSERT conflict

-- target so a cron re-fire for the same run day is a no-op. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_rank_snapshots" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "property" text not null,
  "run_date" date not null,
  "keyword" text not null,
  "locale" text not null default 'default',
  "device" text not null default 'all',
  "ranking_url" text,
  "position" real,
  "previous_position" real,
  "delta" real,
  "clicks" integer not null default 0,
  "impressions" integer not null default 0,
  "ctr" real,
  "avg_position" real,
  "status" text not null default 'flat' check (status in ('gained','lost','new','dropped','flat')),
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_rank_snapshots_tenant_kw_locale_device_run_uidx" on "public"."tmpl_seo_rank_snapshots" ("tenant", "keyword", "locale", "device", "run_date");

create index if not exists "tmpl_seo_rank_snapshots_tenant_kw_run_idx" on "public"."tmpl_seo_rank_snapshots" ("tenant", "keyword", "run_date" desc);

alter table "public"."tmpl_seo_rank_snapshots" enable row level security;

revoke all on "public"."tmpl_seo_rank_snapshots" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_rank_snapshots" to service_role;

drop policy if exists "tmpl_seo_rank_snapshots_service_all" on "public"."tmpl_seo_rank_snapshots";
create policy "tmpl_seo_rank_snapshots_service_all"
  on "public"."tmpl_seo_rank_snapshots" for all
  to service_role
  using (true)
  with check (true);
