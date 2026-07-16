-- =============================================================================
-- TEMPLATE content-gen — [TEMPLATE] SEO content briefs ([content_gen_plugin] brick, DRAFT-FIRST SERP-grounded content-brief ledger, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [content_gen_plugin] content-briefs ledger (app data Shopify does not own,

-- §8.1 shape 1) — SEO-suite brick #7 (Content Generation / Briefs). EXCLUSIVE to this brick;

-- NOT tmpl_seo_keyword_research / tmpl_seo_content_findings / tmpl_seo_findings /

-- tmpl_seo_technical_findings. A DRAFT-FIRST SEO content brief GROUNDED in real SERP data:

-- grounding is the SERP-fact audit trail; recommended_title/meta + outline + entities +

-- word_count_target are the LLM generation-seam outputs (NULLable — an unbound seam writes an

-- honest placeholder draft). status (draft|approved|used|discarded) is the human review

-- lifecycle; the brief is never auto-published. UNIQUE (tenant, brief_id, run_date) → per-day

-- idempotent upsert, brief revisions over time. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_content_briefs" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "target_keyword" text not null,
  "cluster_label" text,
  "brief_id" text not null,
  "recommended_title" text,
  "recommended_meta" text,
  "outline" jsonb not null default '[]'::jsonb,
  "entities" jsonb not null default '[]'::jsonb,
  "target_intent" text,
  "word_count_target" integer,
  "internal_links" jsonb not null default '[]'::jsonb,
  "grounding" jsonb not null default '{}'::jsonb,
  "status" text not null default 'draft' check (status in ('draft','approved','used','discarded')),
  "run_date" date not null,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_content_briefs_tenant_brief_run_uidx" on "public"."tmpl_seo_content_briefs" ("tenant", "brief_id", "run_date");

create index if not exists "tmpl_seo_content_briefs_tenant_run_idx" on "public"."tmpl_seo_content_briefs" ("tenant", "run_date");

create index if not exists "tmpl_seo_content_briefs_tenant_status_idx" on "public"."tmpl_seo_content_briefs" ("tenant", "status");

alter table "public"."tmpl_seo_content_briefs" enable row level security;

revoke all on "public"."tmpl_seo_content_briefs" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_content_briefs" to service_role;

drop policy if exists "tmpl_seo_content_briefs_service_all" on "public"."tmpl_seo_content_briefs";
create policy "tmpl_seo_content_briefs_service_all"
  on "public"."tmpl_seo_content_briefs" for all
  to service_role
  using (true)
  with check (true);
