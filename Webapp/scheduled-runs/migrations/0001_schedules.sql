-- =============================================================================
-- migrations/0001_schedules.sql  —  feature: scheduled-runs
--
-- Persists a per-task recurrence cadence so a hosted n8n Schedule Trigger can
-- poll for due rows and re-fire the task's signed webhook. This is app data
-- Shopify does NOT own (baseline §8.1, shape #1: dashboard/app state) — so it
-- lives in Supabase under the owner's RLS scope, never mirrored from commerce
-- state. The cadence math that advances `next_run_at` lives in src/cadence.mjs
-- and is mirrored by the hosted Code node (docs/n8n-schedule-workflow.md); the
-- table is the only piece that ships into the client repo.
--
-- Idempotent: drop-if-exists + create (Postgres has no CREATE POLICY IF NOT
-- EXISTS). Re-applies cleanly. RLS is asserted enabled; baseline grants are
-- REVOKEd from anon/public so the table is reachable ONLY through a policy.
-- =============================================================================

create table if not exists public.schedules (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- cadence (the recurrence the user chose)
  repeat        text not null default 'once'
                check (repeat in ('once', 'weekly', 'monthly', 'custom')),
  -- interval in days; required for 'custom', null otherwise (enforced below)
  custom_days   integer
                check (custom_days is null or custom_days >= 1),

  -- run bookkeeping (the poller reads next_run_at, advances it after firing)
  run_at        timestamptz,            -- the user's first/anchor run instant
  next_run_at   timestamptz,            -- when this row next becomes due (null = done)
  last_run_at   timestamptz,            -- when it last fired (history; never deleted)

  -- flags
  active        boolean not null default true,   -- gates the poller; soft-cancel flips this
  email_on_done boolean not null default false,  -- email the output when the run completes
  same_params   boolean not null default true,   -- re-use the task's params each run

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- 'custom' must carry an interval; the others must not.
  constraint schedules_custom_days_consistent check (
    (repeat = 'custom' and custom_days is not null) or
    (repeat <> 'custom' and custom_days is null)
  )
);

-- The poller's hot path: "active rows that are due now", owner-agnostic (it
-- runs as service_role). Partial index keeps it tight.
create index if not exists schedules_due_idx
  on public.schedules (next_run_at)
  where active;

create index if not exists schedules_task_idx on public.schedules (task_id);

-- -----------------------------------------------------------------------------
-- RLS — owner-scoped. Every row belongs to exactly one user; the signed-in user
-- may only ever see/touch their own. The service_role (the hosted poller's
-- credential) has full access so it can advance next_run_at across all owners.
-- -----------------------------------------------------------------------------
alter table public.schedules enable row level security;

-- Strip baseline grants so the table is reachable ONLY via a policy below —
-- anon/public get nothing (REVOKE discipline; the gap that let Tessera's
-- DEFECT-1 through).
revoke all on public.schedules from anon, public;

-- A signed-in user owns its own schedules (select/insert/update/delete).
drop policy if exists schedules_owner_all on public.schedules;
create policy schedules_owner_all on public.schedules
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The hosted poller writes as the service role: read due rows, advance them.
drop policy if exists schedules_service_all on public.schedules;
create policy schedules_service_all on public.schedules
  for all to service_role
  using (true) with check (true);
