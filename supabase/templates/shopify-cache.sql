-- =============================================================================
-- TEMPLATE shopify-cache — [TEMPLATE] Shopify cache (short-lived, reconciled — never a mirror)
-- §8.1 shape (2): a short-lived CACHE — NOT a source of truth; reconciled to Shopify.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- CACHE, NOT a source of truth: short-lived, explicitly stale (ttl_seconds), always

-- reconciled to Shopify as truth. Server-managed only; no client role touches it.

create table if not exists "public"."tmpl_shopify_cache" (
  "resource" text not null,
  "resource_id" text not null,
  "fetched_at" timestamptz not null default now(),
  "ttl_seconds" integer not null default 60,
  "data" jsonb not null default '{}'::jsonb,
  primary key ("resource", "resource_id")
);

alter table "public"."tmpl_shopify_cache" enable row level security;

revoke all on "public"."tmpl_shopify_cache" from anon, public;

grant select, insert, update, delete on "public"."tmpl_shopify_cache" to service_role;

drop policy if exists "tmpl_shopify_cache_service_all" on "public"."tmpl_shopify_cache";
create policy "tmpl_shopify_cache_service_all"
  on "public"."tmpl_shopify_cache" for all
  to service_role
  using (true)
  with check (true);
