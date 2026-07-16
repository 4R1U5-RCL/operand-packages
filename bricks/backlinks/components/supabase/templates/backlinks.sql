-- =============================================================================
-- TEMPLATE backlinks — [TEMPLATE] SEO backlink findings ([backlinks_plugin] brick, grounded referring-domain/link-gap ledger, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [backlinks_plugin] backlink-findings ledger (app data Shopify does not own,

-- §8.1 shape 1) — SEO-suite brick #6. EXCLUSIVE to this brick; NOT tmpl_seo_competitor_gaps /

-- tmpl_seo_keyword_research / tmpl_seo_findings / tmpl_seo_technical_findings. Every field

-- traces to a DataForSEO Backlinks API fact (grounding); finding_class enum-locked;

-- competitor set only on link_gap rows; priority_score/recommendation are the fail-open LLM

-- enrichment (NULLable). UNIQUE (tenant, finding_id, run_date) → per-day idempotent upsert.

-- Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_backlink_findings" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "domain" text,
  "finding_id" text not null,
  "finding_class" text not null check (finding_class in ('referring_domain','link_gap','anchor','authority','toxic')),
  "referring_domain" text,
  "competitor" text,
  "domain_authority" real,
  "anchor" text,
  "priority_score" real,
  "recommendation" text,
  "evidence" jsonb not null default '{}'::jsonb,
  "status" text not null default 'open' check (status in ('open','pursued','ignored')),
  "run_date" date not null,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_backlink_findings_tenant_finding_run_uidx" on "public"."tmpl_seo_backlink_findings" ("tenant", "finding_id", "run_date");

create index if not exists "tmpl_seo_backlink_findings_tenant_run_idx" on "public"."tmpl_seo_backlink_findings" ("tenant", "run_date" desc);

create index if not exists "tmpl_seo_backlink_findings_tenant_class_idx" on "public"."tmpl_seo_backlink_findings" ("tenant", "finding_class");

alter table "public"."tmpl_seo_backlink_findings" enable row level security;

revoke all on "public"."tmpl_seo_backlink_findings" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_backlink_findings" to service_role;

drop policy if exists "tmpl_seo_backlink_findings_service_all" on "public"."tmpl_seo_backlink_findings";
create policy "tmpl_seo_backlink_findings_service_all"
  on "public"."tmpl_seo_backlink_findings" for all
  to service_role
  using (true)
  with check (true);
