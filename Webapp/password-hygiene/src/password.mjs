// password-hygiene/src/password.mjs — server-side password strength + breach guard.
//
// One self-contained, dependency-free module (Node 22 built-ins only: node:crypto).
// It does two things on signup/reset:
//   1. Deterministic rules — a minimum length + character-class variety floor.
//   2. A HaveIBeenPwned k-anonymity breach check — only the FIRST 5 CHARS of the
//      SHA-1 hash ever leave the box. The remaining 35 chars (the suffix) are
//      matched LOCALLY against the range the API returns, so the password itself
//      is never transmitted. (See CLAUDE.md — this is the load-bearing boundary.)
//
// FAILS OPEN: if the breach service is unreachable, the password is treated as
// acceptable (rules still apply). A transient HIBP outage must never lock a real
// person out of signing up — availability beats the breach signal here.
//
// The breach lookup is INJECTED (`fetchRange`) so the whole thing is unit-testable
// offline with a fixture range and no network. The default talks to the real API.

import { createHash } from "node:crypto";

/** Minimum password length. Below this is always rejected (length is the single
 *  strongest predictor of strength). */
export const MIN_LENGTH = 8;

/** Of {lowercase, uppercase, number, symbol}, how many distinct classes a
 *  password must contain. Variety without forcing one specific symbol. */
export const MIN_CLASSES = 3;

const CLASSES = [
  [/[a-z]/, "a lowercase letter"],
  [/[A-Z]/, "an uppercase letter"],
  [/[0-9]/, "a number"],
  [/[^A-Za-z0-9]/, "a symbol"],
];

/**
 * Full uppercase SHA-1 hex of the password. Internal — its prefix is the ONLY
 * part that may leave the box; the full digest stays local.
 */
function sha1Hex(password) {
  return createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
}

/**
 * Split the SHA-1 digest the HIBP k-anonymity way: a 5-char `prefix` (the only
 * thing sent to the API) and the 35-char `suffix` (matched locally, never sent).
 * PURE — no I/O, so a test can assert the split deterministically.
 *
 * @param {string} password
 * @returns {{ prefix: string, suffix: string }}
 */
export function sha1Prefix(password) {
  const hash = sha1Hex(password);
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

/** Apply the deterministic rules; return a (possibly empty) list of reasons. */
function ruleReasons(password) {
  const reasons = [];
  if (password.length < MIN_LENGTH) {
    reasons.push(`Use at least ${MIN_LENGTH} characters.`);
  }
  const missing = CLASSES.filter(([re]) => !re.test(password)).map(([, name]) => name);
  const present = CLASSES.length - missing.length;
  if (present < MIN_CLASSES) {
    reasons.push(
      `Add more variety — use at least ${MIN_CLASSES} of: lowercase, uppercase, number, symbol (missing ${missing.join(", ")}).`,
    );
  }
  return reasons;
}

/**
 * Match the local suffix against an HIBP range body (lines of `SUFFIX:COUNT`,
 * possibly padded with COUNT=0 rows). Returns the breach count, 0 if absent.
 */
function matchSuffix(rangeBody, suffix) {
  for (const line of String(rangeBody).split("\n")) {
    const [suf, count] = line.trim().split(":");
    if (suf === suffix) return Number(count) || 0;
  }
  return 0;
}

/** Default range fetcher: the real HIBP k-anonymity endpoint. Only the 5-char
 *  prefix is placed in the URL; `Add-Padding` hides the real row count. */
async function defaultFetchRange(prefix) {
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HIBP range ${prefix} -> HTTP ${res.status}`);
  return res.text();
}

/**
 * Server-side password strength check: rules + HIBP breach lookup.
 *
 * @param {string} password
 * @param {{ fetchRange?: (prefix: string) => Promise<string> }} [opts]
 *        `fetchRange` is injected for offline testing; defaults to the live API.
 * @returns {Promise<{ ok: boolean, reasons: string[], breached: boolean, breachCount: number }>}
 *
 * `ok` is true only when no rule failed AND the password is not known-breached.
 * If the breach lookup throws (HIBP unreachable), it FAILS OPEN: `breached`
 * stays false, no breach reason is added, and `ok` rides on the rules alone.
 */
export async function checkPasswordStrength(password, { fetchRange = defaultFetchRange } = {}) {
  const reasons = ruleReasons(password);
  let breached = false;
  let breachCount = 0;

  const { prefix, suffix } = sha1Prefix(password);
  try {
    const count = matchSuffix(await fetchRange(prefix), suffix);
    if (count > 0) {
      breached = true;
      breachCount = count;
      reasons.push("This password has appeared in a known data breach — choose a different one.");
    }
  } catch {
    // HIBP unreachable — FAIL OPEN. Never block signup on an outage.
  }

  return { ok: reasons.length === 0, reasons, breached, breachCount };
}
