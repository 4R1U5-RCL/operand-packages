-- =============================================================================
-- TEMPLATE dirnotif-config — [TEMPLATE] Lead radar config ([dirnotif_plugin] brick, owner-managed sources/keywords/thresholds, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [dirnotif_plugin] owner-managed tuning config (app data Shopify does not own,

-- §8.1 shape 1), EXCLUSIVE to the dirnotif_plugin family. value is plain-text DATA the workflow

-- interprets in-code — NO jsonb/command column, never executable content. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_dirnotif_config" (
  "id" uuid primary key default gen_random_uuid(),
  "config_type" text not null check (config_type in ('source','keyword','negative_keyword','threshold')),
  "value" text not null,
  "source" text,
  "enabled" boolean not null default true,
  "created_at" timestamptz not null default now()
);

create index if not exists "tmpl_dirnotif_config_type_enabled_idx" on "public"."tmpl_dirnotif_config" ("config_type", "enabled");

alter table "public"."tmpl_dirnotif_config" enable row level security;

revoke all on "public"."tmpl_dirnotif_config" from anon, public;

grant select, insert, update, delete on "public"."tmpl_dirnotif_config" to service_role;

drop policy if exists "tmpl_dirnotif_config_service_all" on "public"."tmpl_dirnotif_config";
create policy "tmpl_dirnotif_config_service_all"
  on "public"."tmpl_dirnotif_config" for all
  to service_role
  using (true)
  with check (true);
