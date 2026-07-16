-- =============================================================================
-- TEMPLATE seo-audit-runs — [TEMPLATE] SEO audit orchestrator ledgers ([seo_audit_orchestrator_plugin] brick, run + prioritized work-queue, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [seo_audit_orchestrator_plugin] ledgers (app data Shopify does not own, §8.1

-- shape 1) — the SEO-suite goal-endpoint. Two ISOLATED tables, EXCLUSIVE to this brick; it

-- READS the child ledgers via their own slots and writes ONLY these. child_status/merged_from

-- are the grounding + dedup honesty trail. UNIQUE keys give per-day idempotent UPSERTs.

-- Server-write-only TABLE-WIDE (no public read surface).

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_audit_runs" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "target" text not null default '',
  "run_date" date not null,
  "status" text not null default 'pending' check (status in ('pending','complete','no_data','error')),
  "child_status" jsonb not null default '{}'::jsonb,
  "summary" text,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_audit_runs_tenant_target_run_uidx" on "public"."tmpl_seo_audit_runs" ("tenant", "target", "run_date");

alter table "public"."tmpl_seo_audit_runs" enable row level security;

revoke all on "public"."tmpl_seo_audit_runs" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_audit_runs" to service_role;

drop policy if exists "tmpl_seo_audit_runs_service_all" on "public"."tmpl_seo_audit_runs";
create policy "tmpl_seo_audit_runs_service_all"
  on "public"."tmpl_seo_audit_runs" for all
  to service_role
  using (true)
  with check (true);

create table if not exists "public"."tmpl_seo_audit_queue" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "run_date" date not null,
  "task_id" text not null,
  "url_or_entity" text,
  "issue_classes" jsonb not null default '[]'::jsonb,
  "severity" text not null default 'info' check (severity in ('critical','high','medium','low','info')),
  "merged_from" jsonb not null default '[]'::jsonb,
  "priority_score" integer not null default 0,
  "impact" integer,
  "effort" integer,
  "recommendation" text,
  "status" text not null default 'open' check (status in ('open','done','dismissed')),
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_audit_queue_tenant_run_task_uidx" on "public"."tmpl_seo_audit_queue" ("tenant", "run_date", "task_id");

create index if not exists "tmpl_seo_audit_queue_tenant_run_prio_idx" on "public"."tmpl_seo_audit_queue" ("tenant", "run_date", "priority_score");

alter table "public"."tmpl_seo_audit_queue" enable row level security;

revoke all on "public"."tmpl_seo_audit_queue" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_audit_queue" to service_role;

drop policy if exists "tmpl_seo_audit_queue_service_all" on "public"."tmpl_seo_audit_queue";
create policy "tmpl_seo_audit_queue_service_all"
  on "public"."tmpl_seo_audit_queue" for all
  to service_role
  using (true)
  with check (true);
