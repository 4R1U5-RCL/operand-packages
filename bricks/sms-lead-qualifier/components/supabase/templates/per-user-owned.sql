-- =============================================================================
-- TEMPLATE per-user-owned — [TEMPLATE] Per-user owned (app data, RLS by owner)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_per_user_owned" (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamptz not null default now(),
  "user_id" uuid not null references auth.users (id) on delete cascade,
  "url" text,
  "status" text not null default 'pending',
  "extra" jsonb not null default '{}'::jsonb
);

alter table "public"."tmpl_per_user_owned" enable row level security;

revoke all on "public"."tmpl_per_user_owned" from anon, public;

grant select, insert, update, delete on "public"."tmpl_per_user_owned" to authenticated;

grant select, insert, update, delete on "public"."tmpl_per_user_owned" to service_role;

drop policy if exists "tmpl_per_user_owned_select_own" on "public"."tmpl_per_user_owned";
create policy "tmpl_per_user_owned_select_own"
  on "public"."tmpl_per_user_owned" for select
  to authenticated
  using ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_per_user_owned_insert_own" on "public"."tmpl_per_user_owned";
create policy "tmpl_per_user_owned_insert_own"
  on "public"."tmpl_per_user_owned" for insert
  to authenticated
  with check ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_per_user_owned_update_own" on "public"."tmpl_per_user_owned";
create policy "tmpl_per_user_owned_update_own"
  on "public"."tmpl_per_user_owned" for update
  to authenticated
  using ((select auth.uid()) = "user_id")
  with check ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_per_user_owned_delete_own" on "public"."tmpl_per_user_owned";
create policy "tmpl_per_user_owned_delete_own"
  on "public"."tmpl_per_user_owned" for delete
  to authenticated
  using ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_per_user_owned_service_all" on "public"."tmpl_per_user_owned";
create policy "tmpl_per_user_owned_service_all"
  on "public"."tmpl_per_user_owned" for all
  to service_role
  using (true)
  with check (true);
