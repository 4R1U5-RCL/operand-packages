-- =============================================================================
-- TEMPLATE scheduled-digest-log — [TEMPLATE] Scheduled digest log ([scheduled_digest] engine, unified send-log + reserve-then-deliver dedup guard, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [scheduled_digest] (Digest) ENGINE send-log / run ledger (app data

-- Shopify does not own, §8.1 shape 1), EXCLUSIVE to the engine — the ONLY table it

-- owns; the digest SOURCE is a caller slot, never provisioned here. Unifies the

-- analytics + radar per-brick logs onto ONE period_key-keyed shape. client_id is

-- NOT NULL (fail-closed tenant key, R-2). UNIQUE (client_id, period_key) is the DEDUP

-- GUARD and the reserve-then-deliver conflict target (R-1) so a cron re-fire — or a

-- concurrent second fire — never double-sends. source_facts is the grounding evidence

-- every digest number traces to. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_scheduled_digest_log" (
  "id" uuid primary key default gen_random_uuid(),
  "client_id" text not null,
  "period_key" text not null,
  "period_start" timestamptz,
  "period_end" timestamptz,
  "sent_at" timestamptz,
  "status" text not null default 'pending' check (status in ('pending','sent','no_data','error')),
  "digest_summary" text,
  "source_facts" jsonb not null default '{}'::jsonb,
  "message_id" text,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_scheduled_digest_log_client_period_uidx" on "public"."tmpl_scheduled_digest_log" ("client_id", "period_key");

create index if not exists "tmpl_scheduled_digest_log_client_period_idx" on "public"."tmpl_scheduled_digest_log" ("client_id", "period_start" desc);

alter table "public"."tmpl_scheduled_digest_log" enable row level security;

revoke all on "public"."tmpl_scheduled_digest_log" from anon, public;

grant select, insert, update, delete on "public"."tmpl_scheduled_digest_log" to service_role;

drop policy if exists "tmpl_scheduled_digest_log_service_all" on "public"."tmpl_scheduled_digest_log";
create policy "tmpl_scheduled_digest_log_service_all"
  on "public"."tmpl_scheduled_digest_log" for all
  to service_role
  using (true)
  with check (true);
