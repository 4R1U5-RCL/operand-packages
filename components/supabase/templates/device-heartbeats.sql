-- =============================================================================
-- TEMPLATE device-heartbeats — [TEMPLATE] Device heartbeats (dead-man liveness, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED liveness state (app data Shopify does not own, §8.1 shape 1): each

-- local runner upserts its row; the hosted n8n dead-mans-switch reads stale rows and

-- alerts. NO payload column. Server-write-only TABLE-WIDE: no client role touches it.

create table if not exists "public"."tmpl_device_heartbeats" (
  "device_id" text primary key,
  "last_seen_at" timestamptz not null default now(),
  "runner_version" text
);

alter table "public"."tmpl_device_heartbeats" enable row level security;

revoke all on "public"."tmpl_device_heartbeats" from anon, public;

grant select, insert, update, delete on "public"."tmpl_device_heartbeats" to service_role;

drop policy if exists "tmpl_device_heartbeats_service_all" on "public"."tmpl_device_heartbeats";
create policy "tmpl_device_heartbeats_service_all"
  on "public"."tmpl_device_heartbeats" for all
  to service_role
  using (true)
  with check (true);
