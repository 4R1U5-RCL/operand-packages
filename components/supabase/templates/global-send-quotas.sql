-- =============================================================================
-- TEMPLATE global-send-quotas — [TEMPLATE] Global send quotas (SHARED durable throttle + spend counter, service-role-only)
-- §8.1 shape (1): APP DATA Shopify does not own.
-- RLS by default; REVOKE discipline; idempotent. Client-AGNOSTIC slots only.
-- =============================================================================

-- SHARED GLOBAL throttle + spend counter (app data Shopify does not own, §8.1 shape 1).

-- The SCOPED datatable-isolation exception (like suppression_list): a platform service

-- every brick shares, hence a generic (non-tmpl_) name. UNIQUE (window_start, channel,

-- sender_id) is the UPSERT-increment key. Server-write-only TABLE-WIDE.

create extension if not exists pgcrypto;

create table if not exists "public"."global_send_quotas" (
  "id" uuid primary key default gen_random_uuid(),
  "window_start" timestamptz not null,
  "channel" text not null check (channel in ('email','sms','llm','dataforseo','firecrawl')),
  "sender_id" text not null,
  "count" integer not null default 0,
  "spend_usd" numeric not null default 0,
  "cap" integer,
  "updated_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now()
);

-- Add the dollar-spend accumulator to a pre-existing table (paid-API metering).

alter table "public"."global_send_quotas" add column if not exists spend_usd numeric not null default 0;

-- Widen the channel CHECK to admit the paid-API channels ('dataforseo','firecrawl').

-- Drop the old constraint (whatever pg auto-named it) and re-add the full set.

do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = "public"."global_send_quotas"::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%channel%';
  if con is not null then
    execute format('alter table "public"."global_send_quotas" drop constraint %I', con);
  end if;
  execute 'alter table "public"."global_send_quotas" add constraint global_send_quotas_channel_check ' ||
          'check (channel in (''email'',''sms'',''llm'',''dataforseo'',''firecrawl''))';
exception when others then
  -- never fail a re-provision on constraint reconciliation; the fresh-table CHECK already holds.
  null;
end $$;

create unique index if not exists "global_send_quotas_window_channel_sender_uidx" on "public"."global_send_quotas" ("window_start", "channel", "sender_id");

create index if not exists "global_send_quotas_channel_window_idx" on "public"."global_send_quotas" ("channel", "window_start");

alter table "public"."global_send_quotas" enable row level security;

revoke all on "public"."global_send_quotas" from anon, public;

grant select, insert, update, delete on "public"."global_send_quotas" to service_role;

drop policy if exists "global_send_quotas_service_all" on "public"."global_send_quotas";
create policy "global_send_quotas_service_all"
  on "public"."global_send_quotas" for all
  to service_role
  using (true)
  with check (true);

create or replace function public.incr_send_quota(
  p_window_start timestamptz,
  p_channel text,
  p_sender_id text,
  p_count integer default 1,
  p_spend_usd numeric default 0,
  p_limit integer default null
) returns table (allowed boolean, count integer, spend_usd numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_spend numeric;
begin
  insert into "public"."global_send_quotas" as q (window_start, channel, sender_id, count, spend_usd, cap, updated_at)
  values (p_window_start, p_channel, p_sender_id, coalesce(p_count, 0), coalesce(p_spend_usd, 0), p_limit, now())
  on conflict (window_start, channel, sender_id) do update
    set count = q.count + coalesce(p_count, 0),
        spend_usd = q.spend_usd + coalesce(p_spend_usd, 0),
        cap = coalesce(p_limit, q.cap),
        updated_at = now()
  returning q.count, q.spend_usd into v_count, v_spend;

  return query select
    (p_limit is null or v_count <= p_limit) as allowed,
    v_count as count,
    v_spend as spend_usd;
end;
$$;

revoke all on function public.incr_send_quota(timestamptz, text, text, integer, numeric, integer) from public, anon, authenticated;

grant execute on function public.incr_send_quota(timestamptz, text, text, integer, numeric, integer) to service_role;
