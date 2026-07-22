-- =============================================================================
-- TEMPLATE dirnotif-digest-log — [TEMPLATE] Lead radar digest log ([dirnotif_plugin] digest add-on, own send-log, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [dirnotif_plugin] DIGEST add-on send-log (app data Shopify does not own,

-- §8.1 shape 1), own table per the add-on-owns-its-own-table rule; EXCLUSIVE to the

-- dirnotif_plugin family. digest_date UNIQUE = once-per-day idempotency key; NO email

-- body/content column — send metadata only. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_dirnotif_digest_log" (
  "id" uuid primary key default gen_random_uuid(),
  "digest_date" date not null unique,
  "sent_at" timestamptz,
  "lead_count" integer not null default 0,
  "hot_count" integer not null default 0,
  "message_id" text,
  "created_at" timestamptz not null default now()
);

alter table "public"."tmpl_dirnotif_digest_log" enable row level security;

revoke all on "public"."tmpl_dirnotif_digest_log" from anon, public;

grant select, insert, update, delete on "public"."tmpl_dirnotif_digest_log" to service_role;

drop policy if exists "tmpl_dirnotif_digest_log_service_all" on "public"."tmpl_dirnotif_digest_log";
create policy "tmpl_dirnotif_digest_log_service_all"
  on "public"."tmpl_dirnotif_digest_log" for all
  to service_role
  using (true)
  with check (true);
