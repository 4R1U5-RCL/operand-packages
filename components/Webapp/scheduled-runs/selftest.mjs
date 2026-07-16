#!/usr/bin/env node
// selftest.mjs — OFFLINE earned checks for the cadence CORE (no clock, no DB,
// no network). Proves nextRunAt for every cadence, isDue's edge cases, advance's
// once→inactive transition, and that migrations/0001_schedules.sql actually
// contains the RLS + REVOKE discipline this package claims. Exits 0 only if
// every assertion holds — a real green, not a "ran without error".
//
// Run: node selftest.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { nextRunAt, isDue, advance, REPEATS } from "./src/cadence.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let n = 0;
const ok = (name) => { n++; process.stdout.write(`  ✓ ${name}\n`); };

// A fixed, injected anchor — nothing here reads a real clock.
const FROM = "2026-06-29T09:00:00.000Z";

// 1. nextRunAt — 'once' never recurs.
{
  assert.equal(nextRunAt({ repeat: "once" }, FROM), null);
  ok("nextRunAt(once) → null (no recurrence)");
}

// 2. nextRunAt — 'weekly' is anchor + 7 days, exactly.
{
  assert.equal(nextRunAt({ repeat: "weekly" }, FROM), "2026-07-06T09:00:00.000Z");
  ok("nextRunAt(weekly) → +7 days");
}

// 3. nextRunAt — 'monthly' is +1 calendar month, and clamps short months.
{
  assert.equal(nextRunAt({ repeat: "monthly" }, FROM), "2026-07-29T09:00:00.000Z");
  // Jan-31 + 1 month must clamp to Feb-28 (2026 is not a leap year), not roll
  // into March.
  assert.equal(
    nextRunAt({ repeat: "monthly" }, "2026-01-31T12:00:00.000Z"),
    "2026-02-28T12:00:00.000Z",
  );
  // Year rollover.
  assert.equal(
    nextRunAt({ repeat: "monthly" }, "2026-12-15T00:00:00.000Z"),
    "2027-01-15T00:00:00.000Z",
  );
  ok("nextRunAt(monthly) → +1 month, clamps short months, rolls year");
}

// 4. nextRunAt — 'custom' is anchor + N days; N must be a positive integer.
{
  assert.equal(nextRunAt({ repeat: "custom", customDays: 3 }, FROM), "2026-07-02T09:00:00.000Z");
  assert.equal(nextRunAt({ repeat: "custom", customDays: 1 }, FROM), "2026-06-30T09:00:00.000Z");
  for (const bad of [0, -5, 2.5, null, undefined, "7"]) {
    assert.throws(() => nextRunAt({ repeat: "custom", customDays: bad }, FROM), RangeError,
      `customDays=${String(bad)} should throw`);
  }
  ok("nextRunAt(custom N) → +N days; rejects non-positive/non-integer N");
}

// 5. nextRunAt — input hardening: unknown repeat, missing cadence, bad date.
{
  assert.throws(() => nextRunAt({ repeat: "yearly" }, FROM), RangeError);
  assert.throws(() => nextRunAt({}, FROM), TypeError);
  assert.throws(() => nextRunAt({ repeat: "weekly" }, "not-a-date"), TypeError);
  // every advertised repeat is handled (no silent fall-through)
  for (const r of REPEATS) {
    assert.doesNotThrow(() => nextRunAt({ repeat: r, customDays: r === "custom" ? 5 : null }, FROM));
  }
  ok("nextRunAt rejects unknown repeat / missing cadence / bad date; covers REPEATS");
}

// 6. nextRunAt accepts Date and epoch-ms anchors, not just ISO strings.
{
  const iso = nextRunAt({ repeat: "weekly" }, new Date(FROM));
  const ms = nextRunAt({ repeat: "weekly" }, Date.parse(FROM));
  assert.equal(iso, "2026-07-06T09:00:00.000Z");
  assert.equal(ms, iso);
  ok("nextRunAt accepts Date | epoch-ms | ISO interchangeably");
}

// 7. isDue — active + next_run_at in the past/now → due; future → not.
{
  const now = FROM;
  assert.equal(isDue({ active: true, next_run_at: "2026-06-29T08:59:00.000Z" }, now), true);
  assert.equal(isDue({ active: true, next_run_at: "2026-06-29T09:01:00.000Z" }, now), false);
  // exactly-now is due (<=).
  assert.equal(isDue({ active: true, next_run_at: FROM }, now), true);
  ok("isDue: past/now due, future not, exactly-now is due");
}

// 8. isDue — guards: inactive, null next_run_at, missing row are never due.
{
  assert.equal(isDue({ active: false, next_run_at: "2000-01-01T00:00:00.000Z" }, FROM), false);
  assert.equal(isDue({ active: true, next_run_at: null }, FROM), false);
  assert.equal(isDue({ next_run_at: FROM }, FROM), false); // active undefined
  assert.equal(isDue(null, FROM), false);
  ok("isDue: inactive / null next_run / missing → never due (no silent fire)");
}

// 9. advance — recurring row advances next_run_at off the SCHEDULED instant
//    (no drift) and stamps last_run_at; stays active.
{
  const row = { repeat: "weekly", next_run_at: "2026-06-29T09:00:00.000Z" };
  // fired 7 minutes late (poller granularity) — next run must NOT inherit the lag.
  const patch = advance(row, "2026-06-29T09:07:00.000Z");
  assert.equal(patch.last_run_at, "2026-06-29T09:07:00.000Z");
  assert.equal(patch.next_run_at, "2026-07-06T09:00:00.000Z"); // anchored, drift-free
  assert.equal(patch.active, undefined); // stays active (not set)
  ok("advance(weekly) → next anchored to schedule (drift-free), keeps active");
}

// 10. advance — a 'once' row fires then goes inactive with no next run.
{
  const patch = advance({ repeat: "once", next_run_at: FROM }, "2026-06-29T09:05:00.000Z");
  assert.equal(patch.next_run_at, null);
  assert.equal(patch.active, false);
  assert.equal(patch.last_run_at, "2026-06-29T09:05:00.000Z");
  ok("advance(once) → next_run_at null + active false (done forever)");
}

// 11. The migration carries the security discipline it claims: RLS enabled,
//     owner-scoped policy, AND a REVOKE from anon/public. This is the earned
//     part — the package's own evaluator hooks (rls/revoke) look for exactly
//     these, so the selftest fails loudly if a refactor drops them.
{
  const sql = readFileSync(join(here, "migrations", "0001_schedules.sql"), "utf8");
  const lower = sql.toLowerCase();
  assert.match(lower, /enable row level security/, "RLS must be enabled");
  assert.match(lower, /create policy .*owner.* on public\.schedules/s, "owner-scoped policy required");
  assert.match(lower, /auth\.uid\(\)[)\s]*=\s*user_id/, "policy must scope to the row owner");
  assert.match(lower, /revoke all on public\.schedules from anon, public/, "REVOKE from anon/public required");
  // and the cadence vocabulary is constrained in-DB, matching src/cadence.mjs.
  for (const r of REPEATS) assert.ok(lower.includes(`'${r}'`), `check constraint must allow '${r}'`);
  ok("migration contains RLS enable + owner policy + REVOKE + cadence check");
}

process.stdout.write(`\nselftest: ${n} checks passed\n`);
