-- =============================================================================
-- TEMPLATE seo-fix-generator — [TEMPLATE] SEO fix generator ledgers ([seo_fix_generator_plugin] brick, candidate-fixes + fix-run, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [seo_fix_generator_plugin] ledgers (app data Shopify does not own, §8.1 shape 1)

-- — the BASE of the SEO remediation layer. Two ISOLATED tables, EXCLUSIVE to this brick; it

-- READS tmpl_seo_audit_queue + tmpl_seo_audit_runs via their own slots and writes ONLY these.

-- finding_id is NOT NULL (grounding guarantee); grounded_from is the evidence audit trail.

-- fix_id is a stable deterministic hash (UPSERT key). status is the human-gated lifecycle;

-- pr_url is the applier's field (never written here). UNIQUE keys give per-key idempotent

-- UPSERTs. Server-write-only TABLE-WIDE (no public read surface).

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_fixes" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "fix_id" text not null,
  "finding_id" text not null,
  "merged_from" jsonb not null default '[]'::jsonb,
  "task_id" text not null,
  "source_brick" text not null default 'seo-fix-generator',
  "fix_type" text not null check (fix_type in ('meta_title','h1','meta_description','jsonld_schema','content_brief','copy_edit')),
  "target_url" text,
  "fix_payload" jsonb not null default '{}'::jsonb,
  "grounded_from" jsonb not null default '{}'::jsonb,
  "model" text,
  "status" text not null default 'generated' check (status in ('generated','draft_pending','approved','applied','verified','rejected','failed')),
  "pr_url" text,
  "run_date" date not null,
  "updated_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_fixes_tenant_fix_uidx" on "public"."tmpl_seo_fixes" ("tenant", "fix_id");

create index if not exists "tmpl_seo_fixes_tenant_status_idx" on "public"."tmpl_seo_fixes" ("tenant", "status");

create index if not exists "tmpl_seo_fixes_tenant_finding_idx" on "public"."tmpl_seo_fixes" ("tenant", "finding_id");

alter table "public"."tmpl_seo_fixes" enable row level security;

revoke all on "public"."tmpl_seo_fixes" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_fixes" to service_role;

drop policy if exists "tmpl_seo_fixes_service_all" on "public"."tmpl_seo_fixes";
create policy "tmpl_seo_fixes_service_all"
  on "public"."tmpl_seo_fixes" for all
  to service_role
  using (true)
  with check (true);

create table if not exists "public"."tmpl_seo_fix_runs" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "run_date" date not null,
  "status" text not null default 'pending' check (status in ('pending','complete','no_data','error')),
  "fixes_generated" integer not null default 0,
  "fixes_draft_pending" integer not null default 0,
  "fixes_skipped" integer not null default 0,
  "source_facts" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_fix_runs_tenant_run_uidx" on "public"."tmpl_seo_fix_runs" ("tenant", "run_date");

create index if not exists "tmpl_seo_fix_runs_tenant_run_idx" on "public"."tmpl_seo_fix_runs" ("tenant", "run_date" desc);

alter table "public"."tmpl_seo_fix_runs" enable row level security;

revoke all on "public"."tmpl_seo_fix_runs" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_fix_runs" to service_role;

drop policy if exists "tmpl_seo_fix_runs_service_all" on "public"."tmpl_seo_fix_runs";
create policy "tmpl_seo_fix_runs_service_all"
  on "public"."tmpl_seo_fix_runs" for all
  to service_role
  using (true)
  with check (true);
