-- =============================================================================
-- TEMPLATE public-capture — [TEMPLATE] Public capture (app data, anon-write / server-read)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_public_capture" (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamptz not null default now(),
  "name" text,
  "email" text,
  "phone" text,
  "source" text,
  "message" text,
  "extra" jsonb not null default '{}'::jsonb
);

alter table "public"."tmpl_public_capture" enable row level security;

revoke all on "public"."tmpl_public_capture" from anon, public;

revoke select ("email", "phone") on "public"."tmpl_public_capture" from anon;

grant insert on "public"."tmpl_public_capture" to anon, authenticated;

grant select on "public"."tmpl_public_capture" to service_role;

drop policy if exists "tmpl_public_capture_insert_public" on "public"."tmpl_public_capture";
create policy "tmpl_public_capture_insert_public"
  on "public"."tmpl_public_capture" for insert
  to anon, authenticated
  with check (true);

drop policy if exists "tmpl_public_capture_select_service" on "public"."tmpl_public_capture";
create policy "tmpl_public_capture_select_service"
  on "public"."tmpl_public_capture" for select
  to service_role
  using (true);
