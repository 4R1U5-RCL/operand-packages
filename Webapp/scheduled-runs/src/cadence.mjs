// src/cadence.mjs — the CORE: pure cadence / next-run math.
//
// This is the one piece of `scheduled-runs` that is fully deterministic and
// offline-testable. It holds NO clock, NO DB, NO network: the caller injects
// `from` and `now`, so every result is reproducible and the selftest can earn
// its pass without touching a wall clock. The hosted n8n Schedule Trigger
// (docs/n8n-schedule-workflow.md) re-implements `advance()`'s logic in a Code
// node — this file is the spec it mirrors, never a thing it imports.
//
// Node 22 built-ins only. No dependencies.

/** The recurrence vocabulary. Anything else is a programming error. */
export const REPEATS = Object.freeze(["once", "weekly", "monthly", "custom"]);

const DAY_MS = 86_400_000;

/** Coerce Date | ISO string | epoch-ms → Date; throw loudly on garbage. */
function toDate(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`cadence: not a valid date: ${String(value)}`);
  }
  return d;
}

/** Add `n` whole days in UTC (DST-safe because we work in fixed ms). */
function addDays(date, n) {
  return new Date(date.getTime() + n * DAY_MS);
}

/**
 * Add `n` calendar months in UTC, clamping the day to the target month's
 * length so Jan-31 + 1mo → Feb-28 (never silently rolls into March).
 */
function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const daysInTarget = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTarget));
  return d;
}

/**
 * Pure next-run computation.
 *
 *   nextRunAt({ repeat: 'once' },            from) → null   (no recurrence)
 *   nextRunAt({ repeat: 'weekly' },          from) → from + 7d
 *   nextRunAt({ repeat: 'monthly' },         from) → from + 1 calendar month
 *   nextRunAt({ repeat: 'custom', customDays: N }, from) → from + N days
 *
 * @param {{ repeat: string, customDays?: number|null }} cadence
 * @param {Date|string|number} from  the anchor instant (caller-injected)
 * @returns {string|null}  ISO-8601 UTC timestamp of the next run, or null when
 *                         the cadence does not recur ('once').
 */
export function nextRunAt(cadence, from) {
  if (!cadence || typeof cadence.repeat !== "string") {
    throw new TypeError("cadence: { repeat } is required");
  }
  const base = toDate(from);

  switch (cadence.repeat) {
    case "once":
      return null;
    case "weekly":
      return addDays(base, 7).toISOString();
    case "monthly":
      return addMonths(base, 1).toISOString();
    case "custom": {
      const n = cadence.customDays;
      if (!Number.isInteger(n) || n < 1) {
        throw new RangeError(
          `cadence: custom requires an integer customDays >= 1, got ${String(n)}`,
        );
      }
      return addDays(base, n).toISOString();
    }
    default:
      throw new RangeError(`cadence: unknown repeat '${cadence.repeat}'`);
  }
}

/**
 * Is this schedule row due to fire at `now`?
 *
 * A row is due iff it is active, has a `next_run_at`, and that instant is at or
 * before `now`. The poller (hosted) injects `now`; this stays a pure predicate
 * so its edge cases (inactive, no next run, exactly-now) are offline-testable.
 *
 * @param {{ active?: boolean, next_run_at?: string|number|Date|null }} row
 * @param {Date|string|number} now  the poll instant (caller-injected)
 * @returns {boolean}
 */
export function isDue(row, now) {
  if (!row || row.active !== true) return false;
  if (row.next_run_at == null) return false;
  const due = toDate(row.next_run_at).getTime();
  return due <= toDate(now).getTime();
}

/**
 * Advance a just-fired row: compute its next `next_run_at` and stamp
 * `last_run_at`. Returns a *patch* (not a mutated row) — the hosted Code node
 * applies the equivalent UPDATE. A 'once' row advances to next_run_at = null
 * and active = false (it has run; it should never fire again).
 *
 * @param {{ repeat: string, customDays?: number|null, next_run_at?: any }} row
 * @param {Date|string|number} firedAt  when the run actually fired
 * @returns {{ last_run_at: string, next_run_at: string|null, active?: boolean }}
 */
export function advance(row, firedAt) {
  const last = toDate(firedAt).toISOString();
  // Advance from the scheduled instant when present, so cadence does not drift
  // by the poller's ~15-min granularity; fall back to firedAt for a fresh row.
  const anchor = row.next_run_at != null ? row.next_run_at : firedAt;
  const next = nextRunAt(row, anchor);
  const patch = { last_run_at: last, next_run_at: next };
  if (next === null) patch.active = false;
  return patch;
}
