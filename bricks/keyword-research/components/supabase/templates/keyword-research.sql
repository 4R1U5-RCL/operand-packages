-- =============================================================================
-- TEMPLATE keyword-research — [TEMPLATE] SEO keyword research ([keyword_research_plugin] brick, grounded keyword ledger, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [keyword_research_plugin] keyword ledger (app data Shopify does not own,

-- §8.1 shape 1) — SEO-suite brick #1, EXCLUSIVE to the brick. Every metric traces to a

-- DataForSEO fact (grounding discipline); intent/cluster_label are the fail-open LLM

-- enrichment (NULLable). UNIQUE (tenant, keyword, run_date) is the UPSERT conflict target

-- so a re-run for the same run day is a no-op. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_keyword_research" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "seed" text,
  "keyword" text not null,
  "search_volume" integer,
  "keyword_difficulty" real,
  "cpc" real,
  "competition" real,
  "intent" text check (intent in ('informational','commercial','navigational','transactional')),
  "cluster_label" text,
  "run_date" date not null,
  "source_facts" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_keyword_research_tenant_keyword_run_uidx" on "public"."tmpl_seo_keyword_research" ("tenant", "keyword", "run_date");

create index if not exists "tmpl_seo_keyword_research_tenant_run_idx" on "public"."tmpl_seo_keyword_research" ("tenant", "run_date" desc);

create index if not exists "tmpl_seo_keyword_research_tenant_cluster_idx" on "public"."tmpl_seo_keyword_research" ("tenant", "cluster_label");

alter table "public"."tmpl_seo_keyword_research" enable row level security;

revoke all on "public"."tmpl_seo_keyword_research" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_keyword_research" to service_role;

drop policy if exists "tmpl_seo_keyword_research_service_all" on "public"."tmpl_seo_keyword_research";
create policy "tmpl_seo_keyword_research_service_all"
  on "public"."tmpl_seo_keyword_research" for all
  to service_role
  using (true)
  with check (true);
