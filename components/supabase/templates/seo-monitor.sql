-- =============================================================================
-- TEMPLATE seo-monitor — [TEMPLATE] SEO monitor ledgers ([seo_monitor_plugin] brick, per-URL snapshots + classified change events, service-role-only)
-- §8.1 shape (3): DERIVED HISTORY — net-new snapshots, NOT a live mirror.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [seo_monitor_plugin] ledgers (derived history, §8.1 shape 3) — SEO Health

-- Monitor / Alerts (SEO-suite #5). Two ISOLATED tables, EXCLUSIVE to this brick. Snapshots

-- are the diff baseline; every event's before/after traces to a real snapshot row (grounding

-- discipline). UNIQUE keys give per-day idempotent UPSERTs. Server-write-only TABLE-WIDE

-- (no public read surface).

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_seo_monitor_snapshots" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "url" text not null,
  "run_date" date not null,
  "title" text,
  "meta_description" text,
  "robots" text,
  "canonical" text,
  "http_status" integer,
  "indexable" boolean,
  "raw" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_monitor_snapshots_tenant_url_run_uidx" on "public"."tmpl_seo_monitor_snapshots" ("tenant", "url", "run_date");

create index if not exists "tmpl_seo_monitor_snapshots_tenant_url_run_idx" on "public"."tmpl_seo_monitor_snapshots" ("tenant", "url", "run_date" desc);

alter table "public"."tmpl_seo_monitor_snapshots" enable row level security;

revoke all on "public"."tmpl_seo_monitor_snapshots" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_monitor_snapshots" to service_role;

drop policy if exists "tmpl_seo_monitor_snapshots_service_all" on "public"."tmpl_seo_monitor_snapshots";
create policy "tmpl_seo_monitor_snapshots_service_all"
  on "public"."tmpl_seo_monitor_snapshots" for all
  to service_role
  using (true)
  with check (true);

create table if not exists "public"."tmpl_seo_monitor_events" (
  "id" uuid primary key default gen_random_uuid(),
  "tenant" text not null default 'operand',
  "url" text not null,
  "event_id" text not null,
  "change_class" text not null check (change_class in ('indexability','robots','canonical','status','title','meta','sitemap')),
  "severity" text not null default 'info' check (severity in ('critical','high','medium','low','info')),
  "before" text,
  "after" text,
  "run_date" date not null,
  "notified" boolean not null default false,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_seo_monitor_events_tenant_event_run_uidx" on "public"."tmpl_seo_monitor_events" ("tenant", "event_id", "run_date");

create index if not exists "tmpl_seo_monitor_events_tenant_run_sev_idx" on "public"."tmpl_seo_monitor_events" ("tenant", "run_date", "severity");

alter table "public"."tmpl_seo_monitor_events" enable row level security;

revoke all on "public"."tmpl_seo_monitor_events" from anon, public;

grant select, insert, update, delete on "public"."tmpl_seo_monitor_events" to service_role;

drop policy if exists "tmpl_seo_monitor_events_service_all" on "public"."tmpl_seo_monitor_events";
create policy "tmpl_seo_monitor_events_service_all"
  on "public"."tmpl_seo_monitor_events" for all
  to service_role
  using (true)
  with check (true);
