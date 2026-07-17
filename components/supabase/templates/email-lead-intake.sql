-- =============================================================================
-- TEMPLATE email-lead-intake — [TEMPLATE] Email lead intake telemetry ([email_plugin] brick, exclusive, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [email_plugin] telemetry (app data Shopify does not own, §8.1 shape 1),

-- EXCLUSIVE to the email-lead-qualifier brick — never shared with the leads table or

-- any other template. NO body/payload column: bands + timestamps + Gmail ids only.

-- gmail_message_id UNIQUE = the re-poll idempotency key. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_email_lead_intake" (
  "id" uuid primary key default gen_random_uuid(),
  "band" text not null check (band in ('HOT','WARM','COLD')),
  "score" integer not null,
  "source" text not null default 'email',
  "received_at" timestamptz not null,
  "notified_at" timestamptz,
  "acked_at" timestamptz,
  "gmail_message_id" text not null unique,
  "thread_id" text,
  "created_at" timestamptz not null default now()
);

alter table "public"."tmpl_email_lead_intake" enable row level security;

revoke all on "public"."tmpl_email_lead_intake" from anon, public;

grant select, insert, update, delete on "public"."tmpl_email_lead_intake" to service_role;

drop policy if exists "tmpl_email_lead_intake_service_all" on "public"."tmpl_email_lead_intake";
create policy "tmpl_email_lead_intake_service_all"
  on "public"."tmpl_email_lead_intake" for all
  to service_role
  using (true)
  with check (true);
