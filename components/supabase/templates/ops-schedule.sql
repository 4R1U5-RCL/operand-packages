-- =============================================================================
-- TEMPLATE ops-schedule — [TEMPLATE] Ops schedule (studio-owned dispatch queue, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED dispatch queue (app data Shopify does not own, §8.1 shape 1): the

-- hosted n8n reads "due" rows and writes last_dispatched_at. NOT a mirror of Shopify

-- order/stock/payment state. Server-write-only TABLE-WIDE: no client role touches it.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_ops_schedule" (
  "id" uuid primary key default gen_random_uuid(),
  "task_id" text not null,
  "due_at" timestamptz,
  "payload" jsonb not null default '{}'::jsonb,
  "enabled" boolean not null default false,
  "last_dispatched_at" timestamptz
);

alter table "public"."tmpl_ops_schedule" enable row level security;

revoke all on "public"."tmpl_ops_schedule" from anon, public;

grant select, insert, update, delete on "public"."tmpl_ops_schedule" to service_role;

drop policy if exists "tmpl_ops_schedule_service_all" on "public"."tmpl_ops_schedule";
create policy "tmpl_ops_schedule_service_all"
  on "public"."tmpl_ops_schedule" for all
  to service_role
  using (true)
  with check (true);
