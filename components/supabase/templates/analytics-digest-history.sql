-- =============================================================================
-- TEMPLATE analytics-digest-history — [TEMPLATE] Analytics digest history ([analytics_digest_plugin] brick, run ledger + dedup guard, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [analytics_digest_plugin] run ledger (app data Shopify does not own,

-- §8.1 shape 1), EXCLUSIVE to the brick. source_facts is the grounding evidence — every

-- number in the digest traces to a fact pulled from PostHog. UNIQUE (client_id,

-- period_start, period_end) is the DEDUP GUARD: one digest per client per period, the

-- upsert conflict target so a cron re-fire never double-sends. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_analytics_digest_history" (
  "id" uuid primary key default gen_random_uuid(),
  "client_id" text not null,
  "period_start" timestamptz not null,
  "period_end" timestamptz not null,
  "sent_at" timestamptz,
  "status" text not null default 'pending' check (status in ('pending','sent','no_data','error')),
  "digest_summary" text,
  "source_facts" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_analytics_digest_history_client_period_uidx" on "public"."tmpl_analytics_digest_history" ("client_id", "period_start", "period_end");

create index if not exists "tmpl_analytics_digest_history_client_period_idx" on "public"."tmpl_analytics_digest_history" ("client_id", "period_start" desc);

alter table "public"."tmpl_analytics_digest_history" enable row level security;

revoke all on "public"."tmpl_analytics_digest_history" from anon, public;

grant select, insert, update, delete on "public"."tmpl_analytics_digest_history" to service_role;

drop policy if exists "tmpl_analytics_digest_history_service_all" on "public"."tmpl_analytics_digest_history";
create policy "tmpl_analytics_digest_history_service_all"
  on "public"."tmpl_analytics_digest_history" for all
  to service_role
  using (true)
  with check (true);
