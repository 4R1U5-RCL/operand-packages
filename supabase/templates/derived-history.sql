-- =============================================================================
-- TEMPLATE derived-history — [TEMPLATE] Derived history (append-only snapshots)
-- §8.1 shape (3): DERIVED HISTORY — net-new snapshots, NOT a live mirror.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- DERIVED HISTORY: net-new snapshots Shopify does not retain. NOT a live mirror —

-- it never answers "what is it now" (read live from Shopify), only "how it moved".

create table if not exists "public"."tmpl_derived_history" (
  "id" bigint generated always as identity primary key,
  "entity_id" text not null,
  "value" integer not null,
  "captured_at" timestamptz not null default now()
);

create index if not exists "tmpl_derived_history_entity_time_idx" on "public"."tmpl_derived_history" ("entity_id", "captured_at" desc);

alter table "public"."tmpl_derived_history" enable row level security;

revoke all on "public"."tmpl_derived_history" from anon, public;

grant insert on "public"."tmpl_derived_history" to service_role;

grant select on "public"."tmpl_derived_history" to authenticated, service_role;

drop policy if exists "tmpl_derived_history_insert_service" on "public"."tmpl_derived_history";
create policy "tmpl_derived_history_insert_service"
  on "public"."tmpl_derived_history" for insert
  to service_role
  with check (true);

drop policy if exists "tmpl_derived_history_select_auth" on "public"."tmpl_derived_history";
create policy "tmpl_derived_history_select_auth"
  on "public"."tmpl_derived_history" for select
  to authenticated, service_role
  using (true);
