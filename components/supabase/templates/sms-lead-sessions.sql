-- =============================================================================
-- TEMPLATE sms-lead-sessions — [TEMPLATE] SMS lead sessions ([sms_plugin] brick, exclusive, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [sms_plugin] session state (app data Shopify does not own, §8.1 shape 1),

-- EXCLUSIVE to the SMS-lead-qualifier brick — never shared with the sms-state-machine

-- session shape or any other template. NO message-body/payload column: verdict state +

-- telemetry only. phone UNIQUE = the select/update key. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_sms_lead_sessions" (
  "id" uuid primary key default gen_random_uuid(),
  "phone" text not null unique,
  "state" text not null default 'unqualified' check (state in ('qualified','unqualified','needs_human')),
  "score" integer not null default 0,
  "reason" text,
  "last_message_at" timestamptz,
  "opted_out_at" timestamptz,
  "last_provider_msg_id" text,
  "created_at" timestamptz not null default now()
);

alter table "public"."tmpl_sms_lead_sessions" enable row level security;

revoke all on "public"."tmpl_sms_lead_sessions" from anon, public;

grant select, insert, update, delete on "public"."tmpl_sms_lead_sessions" to service_role;

drop policy if exists "tmpl_sms_lead_sessions_service_all" on "public"."tmpl_sms_lead_sessions";
create policy "tmpl_sms_lead_sessions_service_all"
  on "public"."tmpl_sms_lead_sessions" for all
  to service_role
  using (true)
  with check (true);
