-- =============================================================================
-- TEMPLATE dirnotif-cursor — [TEMPLATE] Lead radar cursor ([dirnotif_plugin] brick, per-source poll bookmark, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [dirnotif_plugin] per-source poll bookmark (app data Shopify does not own,

-- §8.1 shape 1), EXCLUSIVE to the dirnotif_plugin family. cursor_value is OPAQUE data the

-- workflow interprets in-code — never executable content. Server-write-only TABLE-WIDE.

create table if not exists "public"."tmpl_dirnotif_cursor" (
  "source" text primary key check (source in ('reddit','hackernews','n8n_forum')),
  "cursor_value" text,
  "updated_at" timestamptz not null default now()
);

alter table "public"."tmpl_dirnotif_cursor" enable row level security;

revoke all on "public"."tmpl_dirnotif_cursor" from anon, public;

grant select, insert, update, delete on "public"."tmpl_dirnotif_cursor" to service_role;

drop policy if exists "tmpl_dirnotif_cursor_service_all" on "public"."tmpl_dirnotif_cursor";
create policy "tmpl_dirnotif_cursor_service_all"
  on "public"."tmpl_dirnotif_cursor" for all
  to service_role
  using (true)
  with check (true);
