-- =============================================================================
-- TEMPLATE competitor-gap — [TEMPLATE] SEO competitor / SERP gaps ([competitor_gap_plugin] brick, grounded gap ledger, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [competitor_gap_plugin] competitor / SERP-gap ledger (app data Shopify does

-- not own, §8.1 shape 1) — SEO-suite brick #4. EXCLUSIVE to this brick; NOT

-- tmpl_seo_keyword_research / tmpl_seo_findings / tmpl_seo_technical_findings. Every field

-- traces to a DataForSEO Labs fact (grounding); target_rank NULL = a pure gap;

-- cluster_label/priority_score/recommendation are the fail-open LLM enrichment (NULLable).

-- UNIQUE (tenant, finding_id, run_date) → per-day idempotent upsert, gap time-series.

-- Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_competitor_gaps" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "domain" text,
  "keyword" text not null,
  "finding_id" text not null,
  "competitor" text,
  "competitor_rank" integer,
  "target_rank" integer,
  "search_volume" integer,
  "keyword_difficulty" real,
  "cluster_label" text,
  "priority_score" real,
  "recommendation" text,
  "evidence" jsonb not null default '{}'::jsonb,
  "status" text not null default 'open' check (status in ('open','pursued','ignored')),
  "run_date" date not null,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_competitor_gaps_tenant_finding_run_uidx" on "public"."tmpl_seo_competitor_gaps" ("tenant", "finding_id", "run_date");

create index if not exists "tmpl_seo_competitor_gaps_tenant_run_idx" on "public"."tmpl_seo_competitor_gaps" ("tenant", "run_date" desc);

create index if not exists "tmpl_seo_competitor_gaps_tenant_competitor_idx" on "public"."tmpl_seo_competitor_gaps" ("tenant", "competitor");

alter table "public"."tmpl_seo_competitor_gaps" enable row level security;

revoke all on "public"."tmpl_seo_competitor_gaps" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_competitor_gaps" to service_role;

drop policy if exists "tmpl_seo_competitor_gaps_service_all" on "public"."tmpl_seo_competitor_gaps";
create policy "tmpl_seo_competitor_gaps_service_all"
  on "public"."tmpl_seo_competitor_gaps" for all
  to service_role
  using (true)
  with check (true);
