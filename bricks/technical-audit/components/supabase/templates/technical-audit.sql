-- =============================================================================
-- TEMPLATE technical-audit — [TEMPLATE] SEO technical findings ([technical_audit_plugin] brick, on-page + CWV ledger, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [technical_audit_plugin] technical-findings ledger (app data Shopify does

-- not own, §8.1 shape 1) — SEO-suite brick #2 (Technical Audit; CWV folded in). EXCLUSIVE

-- to this brick; NOT tmpl_seo_findings (that is the seo-improver brick). issue_class covers

-- the on-page classes PLUS 'perf'. evidence is the grounding audit trail; cwv carries

-- {lcp,cls,inp,score}. UNIQUE (tenant, finding_id, run_date) → per-day idempotent upsert,

-- health time-series. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_technical_findings" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "url" text,
  "finding_id" text not null,
  "issue_class" text not null check (issue_class in ('indexability','links','meta','canonical','duplicate','status','perf')),
  "severity" text not null default 'info' check (severity in ('critical','high','medium','low','info')),
  "detail" text,
  "evidence" jsonb not null default '{}'::jsonb,
  "cwv" jsonb,
  "status" text not null default 'open' check (status in ('open','resolved','ignored')),
  "run_date" date not null,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_technical_findings_tenant_finding_run_uidx" on "public"."tmpl_seo_technical_findings" ("tenant", "finding_id", "run_date");

create index if not exists "tmpl_seo_technical_findings_tenant_run_idx" on "public"."tmpl_seo_technical_findings" ("tenant", "run_date");

create index if not exists "tmpl_seo_technical_findings_tenant_class_sev_idx" on "public"."tmpl_seo_technical_findings" ("tenant", "issue_class", "severity");

alter table "public"."tmpl_seo_technical_findings" enable row level security;

revoke all on "public"."tmpl_seo_technical_findings" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_technical_findings" to service_role;

drop policy if exists "tmpl_seo_technical_findings_service_all" on "public"."tmpl_seo_technical_findings";
create policy "tmpl_seo_technical_findings_service_all"
  on "public"."tmpl_seo_technical_findings" for all
  to service_role
  using (true)
  with check (true);
