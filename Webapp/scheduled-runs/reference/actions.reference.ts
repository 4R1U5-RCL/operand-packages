// reference/actions.reference.ts — REFERENCE, not shipped as-is.
//
// App-side server actions for the scheduled-runs feature: create a schedule,
// soft-cancel one, hard-delete one. They are the *only* writers the client app
// needs — the actual firing + next_run_at advance is the hosted n8n Schedule
// Trigger (docs/n8n-schedule-workflow.md), NOT a client-side cron.
//
// This file is `.reference.ts` because it is framework-shaped (Next.js
// "use server", Supabase RLS client) and is meant to be dropped into the
// client app's `app/(app)/tasks/[id]/` surface and wired to the real
// `@/lib/supabase` — it does not run inside this dependency-free package. The
// CORE it depends on (cadence) is the one piece that IS imported live:
// `nextRunAt` here matches src/cadence.mjs exactly so the app seeds the same
// first run the hosted poller will later advance.
//
// Mirrors Tessera's apps/web/.../tasks/[id]/extra-actions.ts discipline: every
// read/write goes through the RLS-scoped server client, so a signed-in user
// only ever touches their own rows.

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient, type Schedule } from '@/lib/supabase';
// The CORE — the same pure math the hosted poller mirrors. Imported, never
// re-implemented, so "first run" here and "advance" there never disagree.
import { nextRunAt } from '../src/cadence.mjs';

export interface CreateScheduleInput {
  /** ISO date from <input type="date">, e.g. '2026-06-29'. */
  date: string;
  /** 'HH:MM' from <input type="time">. */
  time: string;
  /** 'once' | 'weekly' | 'monthly' | 'custom'. */
  repeat: string;
  /** Interval in days when repeat === 'custom'. */
  customDays?: number | null;
  emailOnDone: boolean;
  sameParams: boolean;
}

/** Build a UTC ISO timestamp from the date + time fields, or null if unusable. */
function toRunAt(date: string, time: string): string | null {
  if (!date) return null;
  const stamp = time ? `${date}T${time}` : date;
  const d = new Date(stamp);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Insert a `schedules` row for a task and return the user to the dashboard.
 *
 * The cadence is app data Shopify doesn't own, so it lives in Supabase under
 * the user's RLS scope. `next_run_at` is seeded to the first run (== run_at) so
 * a brand-new schedule is immediately picked up by the next poll; from then on
 * the hosted poller owns advancing it via the same cadence math (`nextRunAt`).
 */
export async function createSchedule(taskId: string, input: CreateScheduleInput) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const runAt = toRunAt(input.date, input.time);
  const customDays = input.repeat === 'custom' ? input.customDays ?? null : null;

  // Seed next_run_at to the anchor run. For a 'once' schedule the poller fires
  // it then advances to null+inactive; for recurring it advances per cadence.
  // (We could equally seed via nextRunAt for a "first run is one interval out"
  // policy — here the first run is the user-picked instant.)
  await supabase.from('schedules').insert({
    task_id: taskId,
    user_id: user.id,
    repeat: input.repeat,
    custom_days: customDays,
    run_at: runAt,
    next_run_at: runAt,
    active: true,
    email_on_done: input.emailOnDone,
    same_params: input.sameParams,
  });

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/**
 * Soft-cancel: flip `active` to false so the poller stops firing the row,
 * WITHOUT deleting it — keeps the cadence + last_run_at history intact. RLS
 * scopes the update to the signed-in user's own rows.
 */
export async function cancelSchedule(id: string): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: row } = await supabase
    .from('schedules')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('task_id')
    .maybeSingle<Pick<Schedule, 'task_id'>>();

  if (row?.task_id) revalidatePath(`/tasks/${row.task_id}/schedule`);
  revalidatePath('/dashboard');
}

/**
 * Hard-delete a schedule. Use when the user wants it gone, not paused —
 * soft-cancel (above) is the default the UI should offer. RLS scopes the delete
 * to the owner; the FK `on delete cascade` from `tasks` covers task removal.
 */
export async function deleteSchedule(id: string): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: row } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)
    .select('task_id')
    .maybeSingle<Pick<Schedule, 'task_id'>>();

  if (row?.task_id) revalidatePath(`/tasks/${row.task_id}/schedule`);
  revalidatePath('/dashboard');
}
