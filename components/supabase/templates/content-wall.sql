-- =============================================================================
-- TEMPLATE content-wall — [TEMPLATE] Content Wall (testimonial; multi-tenant service-role base + anon read via content_wall_public security_barrier view, DB-enforced tenant isolation)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED [content_wall_plugin] multi-tenant, multi-type public content (app

-- data Shopify does not own, §8.1 shape 1), EXCLUSIVE to the Content Wall brick.

-- PARANOID POSTURE: base table is service-role-only, granted to NOBODY else; the

-- ONLY public surface is the security_barrier view below. PII + internals never

-- leave the base table. This public view is scoped to content_type='testimonial'.

create extension if not exists pgcrypto;

create extension if not exists citext;

create table if not exists "public"."tmpl_content_wall" (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamptz not null default now(),
  "client_id" text not null,
  "content_type" text not null check (content_type in ('testimonial', 'review', 'qa', 'showcase')),
  "submitter_name" text,
  "submitter_email" citext,
  "body" text,
  "rating" smallint check (rating is null or rating between 1 and 5),
  "question" text,
  "answer" text,
  "sentiment" text check (sentiment is null or sentiment in ('pos','neu','neg')),
  "themes" text[],
  "moderation_score" real,
  "flags" text[],
  "status" text check (status is null or status in ('pending','needs_review','approved','rejected')),
  "is_approved" boolean not null default false check (is_approved = false or status = 'approved'),
  "is_featured" boolean not null default false,
  "consent_at" timestamptz,
  "source_page" text,
  "deleted_at" timestamptz,
  "request_id" text not null unique,
  "submission_hash" text,
  "extra" jsonb not null default '{}'::jsonb,
  "video_url" text,
  "video_status" text
);

create index if not exists "tmpl_content_wall_read_idx" on "public"."tmpl_content_wall" ("client_id", "content_type", "is_approved", "is_featured");

alter table "public"."tmpl_content_wall" enable row level security;

revoke all on "public"."tmpl_content_wall" from public, anon, authenticated;

grant select, insert, update, delete on "public"."tmpl_content_wall" to service_role;

drop policy if exists "tmpl_content_wall_service_all" on "public"."tmpl_content_wall";
create policy "tmpl_content_wall_service_all"
  on "public"."tmpl_content_wall" for all
  to service_role
  using (true)
  with check (true);

-- PUBLIC READ SURFACE: a security_barrier view. anon reads THIS view only —
-- nothing is granted to anon on "public"."tmpl_content_wall" (the base table stays fully REVOKEd).
-- Views run with the OWNER's rights, so the base REVOKE stands while anon reads
-- the view; security_barrier blocks qual side-channels; the explicit column list
-- cannot drift when a private column is later added.
-- TENANT ISOLATION is DB-ENFORCED here: the reader is bounded to its own
-- client_id JWT claim, NOT a caller-supplied filter. No claim → zero rows.
create or replace view "public"."content_wall_public" with (security_barrier = true) as
  select "id", "content_type", "submitter_name", "body", "rating", "question", "answer", "sentiment", "themes", "created_at"
    from "public"."tmpl_content_wall"
   where content_type = 'testimonial' and is_approved = true and is_featured = true and deleted_at is null
     and "client_id" = (current_setting('request.jwt.claims', true)::jsonb ->> 'client_id');
revoke all on "public"."content_wall_public" from public, anon, authenticated;
grant select on "public"."content_wall_public" to anon;
