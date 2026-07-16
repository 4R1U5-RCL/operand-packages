// packages/n8n-trigger/src/verify.mjs — the INBOUND verifier.
//
// The other half of the seam. When the hosted workflow calls BACK into the app
// (a callback route: "task finished", "report ready"), the app must authenticate
// that caller exactly as the workflow authenticates ours — same primitive, same
// header names, same ±5-min replay window. One signing scheme, both directions.
//
// This is the TE-16 hardening expressed as a reusable guard: a missing, forged,
// or stale signature is REJECTED (401), never trusted. Use it in any inbound n8n
// callback handler over the RAW request body (the exact bytes received — do not
// re-stringify a parsed object, or a byte that didn't round-trip breaks the MAC).
//
// Node 22 built-ins only. No npm deps.

import { createHmac, timingSafeEqual } from "node:crypto";
import { SIG_HEADER, TS_HEADER, MAX_SKEW_MS, sign } from "./client.mjs";

export { SIG_HEADER, TS_HEADER, MAX_SKEW_MS };

/**
 * Verify an inbound signed callback. Constant-time over the signature, and the
 * signed string is `${timestamp}.${rawBody}` — identical to what client.mjs
 * produced outbound, so the two share one primitive.
 *
 * Pure: pass `now` to test the skew window deterministically; defaults to the
 * real clock for production callers.
 *
 * @param {string} rawBody  the EXACT received body bytes (not a re-stringified object)
 * @param {Record<string,string|undefined>} headers  request headers (case-insensitive lookup)
 * @param {{secret:string, now?:number, maxSkewMs?:number}} cfg
 * @returns {{ok:boolean, status:number, reason:string}}  status 200 on ok, 401 on any rejection
 */
export function verify(rawBody, headers, cfg) {
  const secret = cfg?.secret;
  if (!secret) {
    // Not wired is NOT "allow". An unconfigured verifier must fail closed, never
    // wave callers through — the inbound boundary stays shut until a secret exists.
    return reject("not-wired:no-secret");
  }

  const ts = header(headers, TS_HEADER);
  const sig = header(headers, SIG_HEADER);
  if (!ts) return reject("no-timestamp");
  if (!sig) return reject("no-signature");

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return reject("bad-timestamp");

  const now = cfg.now ?? Date.now();
  const skew = Math.abs(now - tsNum);
  const maxSkew = cfg.maxSkewMs ?? MAX_SKEW_MS;
  if (skew > maxSkew) return reject(`stale:${skew}ms>${maxSkew}ms`);

  const expected = sign(`${ts}.${rawBody}`, secret);
  if (!constantTimeEqualHex(sig, expected)) return reject("signature-mismatch");

  return { ok: true, status: 200, reason: "ok" };
}

function reject(reason) {
  return { ok: false, status: 401, reason };
}

/** Case-insensitive header lookup — inbound header casing is not guaranteed. */
function header(headers, name) {
  if (!headers) return undefined;
  const direct = headers[name];
  if (direct != null) return direct;
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return undefined;
}

/** Constant-time compare of two hex strings. A length difference is itself a
 *  mismatch (timingSafeEqual throws on unequal lengths) — checked WITHOUT an
 *  early-returning content compare, so the path is constant-time once lengths
 *  match. */
function constantTimeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}
