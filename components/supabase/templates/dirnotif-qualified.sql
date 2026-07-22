-- =============================================================================
-- TEMPLATE dirnotif-qualified — [TEMPLATE] Lead radar qualified ([dirnotif_plugin] brick, scored leads + status + feedback, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [dirnotif_plugin] qualified-lead write-back (app data Shopify does not own,

-- §8.1 shape 1), EXCLUSIVE to the dirnotif_plugin family; the enrichment add-on MERGES onto

-- these rows and owns no table. snippet is a short public excerpt only. UNIQUE (source,

-- external_id) makes re-qualify an idempotent upsert. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_dirnotif_qualified" (
  "id" uuid primary key default gen_random_uuid(),
  "source" text not null check (source in ('reddit','hackernews','n8n_forum')),
  "external_id" text not null,
  "url" text,
  "title" text,
  "snippet" text,
  "author" text,
  "posted_at" timestamptz,
  "is_relevant" boolean,
  "lead_type" text,
  "fit_score" integer,
  "intent_score" integer,
  "actionability_score" integer,
  "budget_signal" text,
  "urgency" text,
  "composite_score" integer,
  "band" text not null check (band in ('HOT','WARM','REVIEW','COLD')),
  "category" text,
  "why" text,
  "suggested_angle" text,
  "confidence" real,
  "status" text not null default 'new' check (status in ('new','attended','deferred')),
  "notified_at" timestamptz,
  "feedback_at" timestamptz,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_dirnotif_qualified_source_external_uidx" on "public"."tmpl_dirnotif_qualified" ("source", "external_id");

create index if not exists "tmpl_dirnotif_qualified_band_created_idx" on "public"."tmpl_dirnotif_qualified" ("band", "created_at" desc);

create index if not exists "tmpl_dirnotif_qualified_status_idx" on "public"."tmpl_dirnotif_qualified" ("status");

alter table "public"."tmpl_dirnotif_qualified" enable row level security;

revoke all on "public"."tmpl_dirnotif_qualified" from anon, public;

grant select, insert, update, delete on "public"."tmpl_dirnotif_qualified" to service_role;

drop policy if exists "tmpl_dirnotif_qualified_service_all" on "public"."tmpl_dirnotif_qualified";
create policy "tmpl_dirnotif_qualified_service_all"
  on "public"."tmpl_dirnotif_qualified" for all
  to service_role
  using (true)
  with check (true);
