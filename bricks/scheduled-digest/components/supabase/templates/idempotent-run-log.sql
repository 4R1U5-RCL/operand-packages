-- =============================================================================
-- TEMPLATE idempotent-run-log — [TEMPLATE] Idempotent run ledger (per-period send-log)
-- §8.1 shape (3): DERIVED HISTORY — a net-new run ledger, one row per
-- (client_id, period_key), the dedup arbiter for a scheduled digest/dispatch.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- The send-log for a scheduled engine (digest / dispatch): one row per client per
-- period. A UNIQUE(client_id, period_key) index is the RACE ARBITER — a duplicate
-- cron fire loses the INSERT (on_conflict do-nothing), so re-firing is a no-op and
-- exactly-once delivery is enforced by the DB, not a TOCTOU read. service_role
-- writes it (the workflow) ; authenticated may READ its own history to draw a
-- reporting trend. Never a live mirror; net-new run provenance only.

create table if not exists "public"."tmpl_run_log" (
  "id" bigint generated always as identity primary key,
  "client_id" text not null,
  "period_key" text not null,
  "period_start" timestamptz,
  "period_end" timestamptz,
  "status" text not null default 'pending',
  "sent_at" timestamptz,
  "summary" text,
  "source_facts" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

-- The exactly-once arbiter: one ledger row per client per period.
create unique index if not exists "tmpl_run_log_client_period_uidx"
  on "public"."tmpl_run_log" ("client_id", "period_key");

alter table "public"."tmpl_run_log" enable row level security;

revoke all on "public"."tmpl_run_log" from anon, public;

grant insert, update, select on "public"."tmpl_run_log" to service_role;

grant select on "public"."tmpl_run_log" to authenticated, service_role;

drop policy if exists "tmpl_run_log_write_service" on "public"."tmpl_run_log";
create policy "tmpl_run_log_write_service"
  on "public"."tmpl_run_log" for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "tmpl_run_log_select_auth" on "public"."tmpl_run_log";
create policy "tmpl_run_log_select_auth"
  on "public"."tmpl_run_log" for select
  to authenticated, service_role
  using (true);
