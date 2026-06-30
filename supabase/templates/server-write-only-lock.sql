-- =============================================================================
-- TEMPLATE server-write-only-lock — [TEMPLATE] Server-write-only column lock (per-user + billing lock)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

create extension if not exists pgcrypto;

-- Server-write-only columns (plan, stripe_customer_id): the owner reads/inserts/updates the

-- row but CANNOT write these — only the service role / billing webhook may (column REVOKE).

create table if not exists "public"."tmpl_server_write_locked" (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamptz not null default now(),
  "user_id" uuid not null references auth.users (id) on delete cascade,
  "plan" text not null default 'free',
  "stripe_customer_id" text,
  "extra" jsonb not null default '{}'::jsonb
);

alter table "public"."tmpl_server_write_locked" enable row level security;

revoke all on "public"."tmpl_server_write_locked" from anon, public;

grant select, insert, update on "public"."tmpl_server_write_locked" to authenticated;

grant select, insert, update, delete on "public"."tmpl_server_write_locked" to service_role;

revoke update ("plan", "stripe_customer_id") on "public"."tmpl_server_write_locked" from anon, authenticated;

drop policy if exists "tmpl_server_write_locked_select_own" on "public"."tmpl_server_write_locked";
create policy "tmpl_server_write_locked_select_own"
  on "public"."tmpl_server_write_locked" for select
  to authenticated
  using ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_server_write_locked_insert_own" on "public"."tmpl_server_write_locked";
create policy "tmpl_server_write_locked_insert_own"
  on "public"."tmpl_server_write_locked" for insert
  to authenticated
  with check ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_server_write_locked_update_own" on "public"."tmpl_server_write_locked";
create policy "tmpl_server_write_locked_update_own"
  on "public"."tmpl_server_write_locked" for update
  to authenticated
  using ((select auth.uid()) = "user_id")
  with check ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_server_write_locked_service_all" on "public"."tmpl_server_write_locked";
create policy "tmpl_server_write_locked_service_all"
  on "public"."tmpl_server_write_locked" for all
  to service_role
  using (true)
  with check (true);
