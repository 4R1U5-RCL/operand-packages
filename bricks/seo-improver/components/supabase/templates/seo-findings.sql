-- =============================================================================
-- TEMPLATE seo-findings — [TEMPLATE] SEO findings ([seo_improver_plugin] brick, opportunity ledger + Brick-1→Brick-2 seam, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [seo_improver_plugin] opportunity ledger (app data Shopify does not own,

-- §8.1 shape 1) AND the Brick-1 → Brick-2 seam. EXCLUSIVE to the brick. class CHECK lists

-- all four classes incl. the DEFERRED SEO-CTR (future-stable). evidence is the grounding

-- audit trail. UNIQUE (tenant, finding_id) makes re-detection refresh the same row.

-- Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_findings" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "finding_id" text not null,
  "class" text not null check (class in ('SEO-STRIKE','SEO-CTR','SEO-CANN','SEO-DECAY')),
  "target_keyword" text not null,
  "target_url" text,
  "recommendation" text,
  "evidence" jsonb not null default '{}'::jsonb,
  "created_run" date not null,
  "status" text not null default 'open' check (status in ('open','applied','dropped','revised')),
  "applied_run" date,
  "pr_url" text,
  "outcome_position_before" real,
  "outcome_position_after" real,
  "outcome_verdict" text check (outcome_verdict in ('worked','no_change','regressed')),
  "test_status" text check (test_status in ('passed','failed','skipped')),
  "eval_verdict" text check (eval_verdict in ('passed','failed','deferred')),
  "eval_model" text,
  "implementation_run" date,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

-- Phase-2 implementation columns (harness-driven [seo_pr_apply] brick): latest-attempt-wins,

-- all nullable, extended on the brick's OWN table (no companion table; isolation preserved).

alter table "public"."tmpl_seo_findings" add column if not exists "test_status" text;

alter table "public"."tmpl_seo_findings" add column if not exists "eval_verdict" text;

alter table "public"."tmpl_seo_findings" add column if not exists "eval_model" text;

alter table "public"."tmpl_seo_findings" add column if not exists "implementation_run" date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tmpl_seo_findings_test_status_check'
      and conrelid = '"public"."tmpl_seo_findings"'::regclass
  ) then
    alter table "public"."tmpl_seo_findings" add constraint "tmpl_seo_findings_test_status_check" check (test_status in ('passed','failed','skipped'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tmpl_seo_findings_eval_verdict_check'
      and conrelid = '"public"."tmpl_seo_findings"'::regclass
  ) then
    alter table "public"."tmpl_seo_findings" add constraint "tmpl_seo_findings_eval_verdict_check" check (eval_verdict in ('passed','failed','deferred'));
  end if;
end $$;

create unique index if not exists "tmpl_seo_findings_tenant_finding_uidx" on "public"."tmpl_seo_findings" ("tenant", "finding_id");

create index if not exists "tmpl_seo_findings_tenant_status_class_idx" on "public"."tmpl_seo_findings" ("tenant", "status", "class");

alter table "public"."tmpl_seo_findings" enable row level security;

revoke all on "public"."tmpl_seo_findings" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_findings" to service_role;

drop policy if exists "tmpl_seo_findings_service_all" on "public"."tmpl_seo_findings";
create policy "tmpl_seo_findings_service_all"
  on "public"."tmpl_seo_findings" for all
  to service_role
  using (true)
  with check (true);
