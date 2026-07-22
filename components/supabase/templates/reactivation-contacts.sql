-- =============================================================================
-- TEMPLATE reactivation-contacts — [TEMPLATE] Reactivation contacts ([reactivation_plugin] brick, per-contact state, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [reactivation_plugin] campaign definition+state (app data Shopify does not

-- own, §8.1 shape 1), EXCLUSIVE to the brick. enabled defaults false = parked until armed.

-- Server-write-only TABLE-WIDE (composed from primitives, not the per-user helper).

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_reactivation_campaign" (
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "segment" text not null,
  "schedule" jsonb not null default '{}'::jsonb,
  "offer" jsonb not null default '{}'::jsonb,
  "template_copy" text,
  "enabled" boolean not null default false,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "created_at" timestamptz not null default now()
);

alter table "public"."tmpl_reactivation_campaign" enable row level security;

revoke all on "public"."tmpl_reactivation_campaign" from anon, public;

grant select, insert, update, delete on "public"."tmpl_reactivation_campaign" to service_role;

drop policy if exists "tmpl_reactivation_campaign_service_all" on "public"."tmpl_reactivation_campaign";
create policy "tmpl_reactivation_campaign_service_all"
  on "public"."tmpl_reactivation_campaign" for all
  to service_role
  using (true)
  with check (true);

-- STUDIO-OWNED [reactivation_plugin] per-contact state (app data Shopify does not own,

-- §8.1 shape 1), EXCLUSIVE to the brick. timezone gates quiet-hours; NO message body;

-- NO step_N_sent_at (cadence lives in tmpl_reactivation_events). Server-write-only

-- TABLE-WIDE (composed from primitives, not the per-user helper).

create extension if not exists pgcrypto;

create extension if not exists citext;

create table if not exists "public"."tmpl_reactivation_contacts" (
  "id" uuid primary key default gen_random_uuid(),
  "campaign_id" uuid not null references "public"."tmpl_reactivation_campaign" (id) on delete cascade,
  "name" text,
  "email" citext,
  "phone" text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  "timezone" text,
  "zip" text,
  "country" text,
  "status" text not null default 'active' check (status in ('active','hot','booked','suppressed','done')),
  "last_reply_at" timestamptz,
  "created_at" timestamptz not null default now()
);

-- COALESCE-GUARDED unique index — one contact per non-null email/phone within a campaign.
-- (functional index: no createIndex primitive supports it yet — TEMPLATE GAP.)
create unique index if not exists "tmpl_reactivation_contacts_campaign_contact_uidx" on "public"."tmpl_reactivation_contacts" (campaign_id, coalesce(email::text, ''), coalesce(phone, ''));

create index if not exists "tmpl_reactivation_contacts_campaign_status_idx" on "public"."tmpl_reactivation_contacts" ("campaign_id", "status");

alter table "public"."tmpl_reactivation_contacts" enable row level security;

revoke all on "public"."tmpl_reactivation_contacts" from anon, public;

grant select, insert, update, delete on "public"."tmpl_reactivation_contacts" to service_role;

drop policy if exists "tmpl_reactivation_contacts_service_all" on "public"."tmpl_reactivation_contacts";
create policy "tmpl_reactivation_contacts_service_all"
  on "public"."tmpl_reactivation_contacts" for all
  to service_role
  using (true)
  with check (true);
