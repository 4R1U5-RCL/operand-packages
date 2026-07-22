-- =============================================================================
-- TEMPLATE dirnotif-seen — [TEMPLATE] Lead radar seen ([dirnotif_plugin] brick, dedupe + edit-hash, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [dirnotif_plugin] dedupe ledger (app data Shopify does not own, §8.1 shape 1),

-- EXCLUSIVE to the dirnotif_plugin family — never shared with any other template. UNIQUE

-- (source, external_id) = the dedupe key; content_hash detects edits. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_dirnotif_seen" (
  "id" uuid primary key default gen_random_uuid(),
  "source" text not null check (source in ('reddit','hackernews','n8n_forum')),
  "external_id" text not null,
  "content_hash" text,
  "first_seen_at" timestamptz not null default now()
);

create unique index if not exists "tmpl_dirnotif_seen_source_external_uidx" on "public"."tmpl_dirnotif_seen" ("source", "external_id");

alter table "public"."tmpl_dirnotif_seen" enable row level security;

revoke all on "public"."tmpl_dirnotif_seen" from anon, public;

grant select, insert, update, delete on "public"."tmpl_dirnotif_seen" to service_role;

drop policy if exists "tmpl_dirnotif_seen_service_all" on "public"."tmpl_dirnotif_seen";
create policy "tmpl_dirnotif_seen_service_all"
  on "public"."tmpl_dirnotif_seen" for all
  to service_role
  using (true)
  with check (true);
