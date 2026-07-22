-- =============================================================================
-- TEMPLATE reactivation-campaign — [TEMPLATE] Reactivation campaign ([reactivation_plugin] brick, definition+state, service-role-only)
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
