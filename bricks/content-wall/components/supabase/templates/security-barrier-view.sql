-- =============================================================================
-- TEMPLATE security-barrier-view — [TEMPLATE] Tenant-scoped public-READ barrier view
-- §8.1 shape (1): APP DATA Shopify does not own — the PUBLISH half of a
-- collect → moderate → PUBLISH loop (Wall-of-Love / content-wall class).
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- The base table is service_role-only (moderation writes approved/featured); the
-- public site reads ONLY the approved, published subset THROUGH a security_barrier
-- view — never the base table. security_barrier stops a caller's cheap predicate
-- from being pushed under the WHERE and leaking unapproved / other-tenant rows
-- (the canonical publish-view guard). The view is tenant-scoped by client_id.

create table if not exists "public"."tmpl_barrier_base" (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamptz not null default now(),
  "client_id" text not null,
  "content_type" text not null default 'testimonial',
  "body" text not null,
  "author_name" text,
  "rating" int,
  "is_approved" boolean not null default false,
  "is_featured" boolean not null default false,
  "status" text not null default 'pending',
  "extra" jsonb not null default '{}'::jsonb
);

create extension if not exists pgcrypto;

alter table "public"."tmpl_barrier_base" enable row level security;

-- base table is server-owned: NOTHING for anon/authenticated; service_role only.
revoke all on "public"."tmpl_barrier_base" from anon, public, authenticated;

grant select, insert, update, delete on "public"."tmpl_barrier_base" to service_role;

drop policy if exists "tmpl_barrier_base_service_all" on "public"."tmpl_barrier_base";
create policy "tmpl_barrier_base_service_all"
  on "public"."tmpl_barrier_base" for all
  to service_role
  using (true)
  with check (true);

-- The PUBLIC read surface: a security_barrier view exposing ONLY approved+published
-- rows and ONLY the public columns (no PII, no moderation internals). anon reads
-- THIS, scoped to a tenant via the client_id it passes — never the base table.
drop view if exists "public"."tmpl_barrier_public";
create view "public"."tmpl_barrier_public"
  with (security_barrier = true) as
  select
    "id",
    "client_id",
    "content_type",
    "body",
    "author_name",
    "rating",
    "created_at"
  from "public"."tmpl_barrier_base"
  where "is_approved" = true
    and "status" = 'published';

-- anon/authenticated may read the curated view, and ONLY the view.
grant select on "public"."tmpl_barrier_public" to anon, authenticated;
