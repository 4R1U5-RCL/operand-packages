-- =============================================================================
-- TEMPLATE apply-runs — [TEMPLATE] SEO apply-run ledger ([seo_pr_apply] brick, PRs/manual/blockers per run, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [seo_pr_apply] run ledger (§8.1 shape 1 — app data Shopify does not own).

-- Mirrors tmpl_seo_audit_runs. One row per apply run; the honesty trail for PRs opened /

-- manual fall-throughs / blockers. Server-write-only TABLE-WIDE (no public read surface).

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_apply_runs" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "run_id" text not null,
  "run_date" date not null,
  "source" text not null default 'fixes' check (source in ('fixes','queue','findings')),
  "tasks_consumed" integer not null default 0,
  "prs_opened" jsonb not null default '[]'::jsonb,
  "manual_fallthroughs" jsonb not null default '[]'::jsonb,
  "blockers" jsonb not null default '[]'::jsonb,
  "status" text not null default 'pending' check (status in ('pending','complete','error')),
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_apply_runs_tenant_run_uidx" on "public"."tmpl_apply_runs" ("tenant", "run_id");

create index if not exists "tmpl_apply_runs_tenant_date_idx" on "public"."tmpl_apply_runs" ("tenant", "run_date" desc);

alter table "public"."tmpl_apply_runs" enable row level security;

revoke all on "public"."tmpl_apply_runs" from anon, public, authenticated;

grant select, insert, update, delete on "public"."tmpl_apply_runs" to service_role;

drop policy if exists "tmpl_apply_runs_service_all" on "public"."tmpl_apply_runs";
create policy "tmpl_apply_runs_service_all"
  on "public"."tmpl_apply_runs" for all
  to service_role
  using (true)
  with check (true);
