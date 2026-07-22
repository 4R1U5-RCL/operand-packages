-- =============================================================================
-- TEMPLATE ops-task-queue — [TEMPLATE] Ops task queue (pull-based runner queue, enum-only, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- STUDIO-OWNED pull queue (app data Shopify does not own, §8.1 shape 1): a local

-- runner claims due rows; the cloud only inserts. NOT a mirror of Shopify state.

-- NO payload/command column — a row NAMES a task (agent_key), the runner resolves it

-- through its fixed in-code allow-list. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."tmpl_ops_task_queue" (
  "id" uuid primary key default gen_random_uuid(),
  "agent_key" text not null,
  "due_at" timestamptz not null,
  "coalesce_key" text,
  "status" text not null default 'pending' check (status in ('pending','claimed','retrying','done','failed','skipped','coalesced')),
  "attempts" integer not null default 0,
  "claimed_at" timestamptz,
  "claimed_by" text,
  "last_error" text,
  "created_at" timestamptz not null default now()
);

create index if not exists "tmpl_ops_task_queue_claim_scan_idx" on "public"."tmpl_ops_task_queue" ("status", "due_at");

alter table "public"."tmpl_ops_task_queue" enable row level security;

revoke all on "public"."tmpl_ops_task_queue" from anon, public;

grant select, insert, update, delete on "public"."tmpl_ops_task_queue" to service_role;

drop policy if exists "tmpl_ops_task_queue_service_all" on "public"."tmpl_ops_task_queue";
create policy "tmpl_ops_task_queue_service_all"
  on "public"."tmpl_ops_task_queue" for all
  to service_role
  using (true)
  with check (true);
