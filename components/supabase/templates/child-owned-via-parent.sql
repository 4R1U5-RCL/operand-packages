-- =============================================================================
-- TEMPLATE child-owned-via-parent — [TEMPLATE] Child owned via parent (transitive RLS)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_parent_requests" (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamptz not null default now(),
  "user_id" uuid not null references auth.users (id) on delete cascade,
  "extra" jsonb not null default '{}'::jsonb
);

alter table "public"."tmpl_parent_requests" enable row level security;

revoke all on "public"."tmpl_parent_requests" from anon, public;

grant select, insert, update, delete on "public"."tmpl_parent_requests" to authenticated;

grant select, insert, update, delete on "public"."tmpl_parent_requests" to service_role;

drop policy if exists "tmpl_parent_requests_select_own" on "public"."tmpl_parent_requests";
create policy "tmpl_parent_requests_select_own"
  on "public"."tmpl_parent_requests" for select
  to authenticated
  using ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_parent_requests_insert_own" on "public"."tmpl_parent_requests";
create policy "tmpl_parent_requests_insert_own"
  on "public"."tmpl_parent_requests" for insert
  to authenticated
  with check ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_parent_requests_update_own" on "public"."tmpl_parent_requests";
create policy "tmpl_parent_requests_update_own"
  on "public"."tmpl_parent_requests" for update
  to authenticated
  using ((select auth.uid()) = "user_id")
  with check ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_parent_requests_delete_own" on "public"."tmpl_parent_requests";
create policy "tmpl_parent_requests_delete_own"
  on "public"."tmpl_parent_requests" for delete
  to authenticated
  using ((select auth.uid()) = "user_id");

drop policy if exists "tmpl_parent_requests_service_all" on "public"."tmpl_parent_requests";
create policy "tmpl_parent_requests_service_all"
  on "public"."tmpl_parent_requests" for all
  to service_role
  using (true)
  with check (true);

create table if not exists "public"."tmpl_child_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamptz not null default now(),
  "request_id" uuid not null references "public"."tmpl_parent_requests" (id) on delete cascade,
  "content" text,
  "metadata" jsonb not null default '{}'::jsonb
);

alter table "public"."tmpl_child_documents" enable row level security;

revoke all on "public"."tmpl_child_documents" from anon, public;

grant select on "public"."tmpl_child_documents" to authenticated;

grant select, insert, update, delete on "public"."tmpl_child_documents" to service_role;

drop policy if exists "tmpl_child_documents_select_own" on "public"."tmpl_child_documents";
create policy "tmpl_child_documents_select_own"
  on "public"."tmpl_child_documents" for select
  to authenticated
  using (exists (select 1 from "public"."tmpl_parent_requests" p where p."id" = "request_id" and p."user_id" = (select auth.uid())));

drop policy if exists "tmpl_child_documents_service_all" on "public"."tmpl_child_documents";
create policy "tmpl_child_documents_service_all"
  on "public"."tmpl_child_documents" for all
  to service_role
  using (true)
  with check (true);
