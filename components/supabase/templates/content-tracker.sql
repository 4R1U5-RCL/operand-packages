-- =============================================================================
-- TEMPLATE content-tracker — [TEMPLATE] SEO content findings ([content_tracker_plugin] brick, on-page content-gap ledger, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [content_tracker_plugin] content-findings ledger (app data Shopify does not

-- own, §8.1 shape 1) — SEO-suite brick #3 (Content / On-Page Tracker). EXCLUSIVE to this

-- brick; NOT tmpl_seo_findings / tmpl_seo_technical_findings / tmpl_seo_keyword_research.

-- issue_class covers coverage|title|meta|headings|thin|intent. evidence is the grounding

-- audit trail (a scraped on-page signal or a DataForSEO keyword fact); recommendation is

-- the ranked LLM content action (NULLable). UNIQUE (tenant, finding_id, run_date) → per-day

-- idempotent upsert, content-health time-series. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_content_findings" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "url" text not null,
  "finding_id" text not null,
  "issue_class" text not null check (issue_class in ('coverage','title','meta','headings','thin','intent')),
  "severity" text not null default 'info' check (severity in ('critical','high','medium','low','info')),
  "target_keyword" text,
  "recommendation" text,
  "evidence" jsonb not null default '{}'::jsonb,
  "status" text not null default 'open' check (status in ('open','resolved','ignored')),
  "run_date" date not null,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_content_findings_tenant_finding_run_uidx" on "public"."tmpl_seo_content_findings" ("tenant", "finding_id", "run_date");

create index if not exists "tmpl_seo_content_findings_tenant_run_idx" on "public"."tmpl_seo_content_findings" ("tenant", "run_date");

create index if not exists "tmpl_seo_content_findings_tenant_class_sev_idx" on "public"."tmpl_seo_content_findings" ("tenant", "issue_class", "severity");

alter table "public"."tmpl_seo_content_findings" enable row level security;

revoke all on "public"."tmpl_seo_content_findings" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_content_findings" to service_role;

drop policy if exists "tmpl_seo_content_findings_service_all" on "public"."tmpl_seo_content_findings";
create policy "tmpl_seo_content_findings_service_all"
  on "public"."tmpl_seo_content_findings" for all
  to service_role
  using (true)
  with check (true);
