-- =============================================================================
-- TEMPLATE seo-additions-migration — [TEMPLATE] SEO Additions migration (pr_url writeback + apply_mode + SERP/AIO columns + SEO-AIO/queued CHECK, additive & idempotent)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- ADDITIVE, IDEMPOTENT, existence-guarded migration (SEO Additions §1 + §2a). No table

-- create; no data loss; re-runnable; a missing target table is a clean no-op.

do $$
begin
  if to_regclass('public.tmpl_seo_findings') is not null then
    alter table "public"."tmpl_seo_findings" add column if not exists "pr_url" text;
    alter table "public"."tmpl_seo_findings" add column if not exists "apply_status" text;
    alter table "public"."tmpl_seo_findings" add column if not exists "apply_class" text;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tmpl_seo_technical_findings') is not null then
    alter table "public"."tmpl_seo_technical_findings" add column if not exists "pr_url" text;
    alter table "public"."tmpl_seo_technical_findings" add column if not exists "apply_status" text;
    alter table "public"."tmpl_seo_technical_findings" add column if not exists "apply_class" text;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tmpl_seo_gsc_findings') is not null then
    alter table "public"."tmpl_seo_gsc_findings" add column if not exists "pr_url" text;
    alter table "public"."tmpl_seo_gsc_findings" add column if not exists "apply_status" text;
    alter table "public"."tmpl_seo_gsc_findings" add column if not exists "apply_class" text;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tmpl_seo_keyword_research') is not null then
    alter table "public"."tmpl_seo_keyword_research" add column if not exists "pr_url" text;
    alter table "public"."tmpl_seo_keyword_research" add column if not exists "apply_status" text;
    alter table "public"."tmpl_seo_keyword_research" add column if not exists "apply_class" text;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tmpl_seo_audit_queue') is not null then
    alter table "public"."tmpl_seo_audit_queue" add column if not exists "pr_url" text;
    alter table "public"."tmpl_seo_audit_queue" add column if not exists "apply_status" text;
    alter table "public"."tmpl_seo_audit_queue" add column if not exists "apply_class" text;
    alter table "public"."tmpl_seo_audit_queue" add column if not exists "apply_mode" text not null default 'git';
  end if;
end $$;

do $$
begin
  if to_regclass('public.tmpl_seo_audit_queue') is not null then
    alter table "public"."tmpl_seo_audit_queue" drop constraint if exists "tmpl_seo_audit_queue_status_check";
    alter table "public"."tmpl_seo_audit_queue" add constraint "tmpl_seo_audit_queue_status_check" check ("status" in ('open', 'queued', 'in_progress', 'done', 'dismissed'));
  end if;
end $$;

do $$
begin
  if to_regclass('public.tmpl_seo_rank_snapshots') is not null then
    alter table "public"."tmpl_seo_rank_snapshots" add column if not exists "serp_features" jsonb;
    alter table "public"."tmpl_seo_rank_snapshots" add column if not exists "ai_overview_present" boolean;
    alter table "public"."tmpl_seo_rank_snapshots" add column if not exists "ai_overview_cited" boolean;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tmpl_seo_findings') is not null then
    alter table "public"."tmpl_seo_findings" drop constraint if exists "tmpl_seo_findings_class_check";
    alter table "public"."tmpl_seo_findings" add constraint "tmpl_seo_findings_class_check" check ("class" in ('SEO-STRIKE', 'SEO-CTR', 'SEO-CANN', 'SEO-DECAY', 'SEO-AIO'));
  end if;
end $$;
