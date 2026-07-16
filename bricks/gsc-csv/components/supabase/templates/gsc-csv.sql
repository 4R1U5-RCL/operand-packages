-- =============================================================================
-- TEMPLATE gsc-csv — [TEMPLATE] GSC CSV ledgers ([gsc_csv_plugin] brick, first-party performance rows + CTR/cannibalization findings, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [gsc_csv_plugin] ledgers (app data Shopify does not own, §8.1 shape 1) —

-- GSC Integration CSV STOPGAP (SEO-suite #9). Two ISOLATED tables, EXCLUSIVE to this brick.

-- tmpl_gsc_performance MIRRORS the future GSC-API writer (drop-in later). Every metric is a

-- parsed CSV value (grounding discipline); expected_ctr is the ONLY modeled value. UNIQUE

-- keys give per-day idempotent UPSERTs. Server-write-only TABLE-WIDE (no public read surface).

-- NO shared spend counter (a CSV parse is not metered).

-- DIMENSION SENTINEL CONTRACT (downstream readers MUST honour): an ABSENT dimension is stored

-- as the NOT-NULL sentinel — '' (property/query/page) or the epoch date '0001-01-01' (date) —

-- so a plain-column unique constraint can back the PostgREST on_conflict UPSERT (a coalesced

-- EXPRESSION index cannot be named by on_conflict). A sentinel means "not present in this

-- export shape", NOT a real value: any aggregation/timeseries over date, or grouping over

-- property/query/page, MUST exclude the sentinel (e.g. `where date <> '0001-01-01'`,

-- `where query <> ''`). The v1 single-property operand feed never emits '' as a genuine value.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_gsc_performance" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "property" text not null default '',
  "query" text not null default '',
  "page" text not null default '',
  "clicks" integer,
  "impressions" integer,
  "ctr" real,
  "position" real,
  "date" date not null default '0001-01-01'::date,
  "run_date" date not null,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_gsc_performance_dedup_uidx" on "public"."tmpl_gsc_performance" ("tenant", "property", "query", "page", "date");

create index if not exists "tmpl_gsc_performance_tenant_run_idx" on "public"."tmpl_gsc_performance" ("tenant", "run_date" desc);

create index if not exists "tmpl_gsc_performance_tenant_query_idx" on "public"."tmpl_gsc_performance" ("tenant", "query");

alter table "public"."tmpl_gsc_performance" enable row level security;

revoke all on "public"."tmpl_gsc_performance" from anon, public;

grant select, insert, update, delete on "public"."tmpl_gsc_performance" to service_role;

drop policy if exists "tmpl_gsc_performance_service_all" on "public"."tmpl_gsc_performance";
create policy "tmpl_gsc_performance_service_all"
  on "public"."tmpl_gsc_performance" for all
  to service_role
  using (true)
  with check (true);

create table if not exists "public"."tmpl_seo_gsc_findings" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "finding_id" text not null,
  "query" text,
  "page" text,
  "finding_class" text not null check (finding_class in ('ctr_opportunity','cannibalization')),
  "impressions" integer,
  "current_ctr" real,
  "position" real,
  "expected_ctr" real,
  "recommendation" text,
  "evidence" jsonb not null default '{}'::jsonb,
  "status" text not null default 'open' check (status in ('open','applied','ignored')),
  "run_date" date not null,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_gsc_findings_tenant_finding_run_uidx" on "public"."tmpl_seo_gsc_findings" ("tenant", "finding_id", "run_date");

create index if not exists "tmpl_seo_gsc_findings_tenant_status_class_idx" on "public"."tmpl_seo_gsc_findings" ("tenant", "status", "finding_class");

alter table "public"."tmpl_seo_gsc_findings" enable row level security;

revoke all on "public"."tmpl_seo_gsc_findings" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_gsc_findings" to service_role;

drop policy if exists "tmpl_seo_gsc_findings_service_all" on "public"."tmpl_seo_gsc_findings";
create policy "tmpl_seo_gsc_findings_service_all"
  on "public"."tmpl_seo_gsc_findings" for all
  to service_role
  using (true)
  with check (true);
