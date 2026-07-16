// packages/n8n-trigger/src/client.mjs — the server-only OUTBOUND trigger seam.
//
// The FOUNDATIONAL seam every other n8n feature reuses: one place where a
// timestamped HMAC-SHA256 signature is constructed and a hosted n8n workflow
// webhook is fired. Other features (verdict, email-report, …) call THROUGH this
// so they all speak the exact same signed contract — they never re-roll signing.
//
// The workflow DEFINITION is studio infra hosted on n8n; this repo only *calls*
// it via a webhook (packages/integrations boundary: hooks only, never the IP).
//
// Node 22 built-ins only. No npm deps. (Same discipline as ~/packages/Claude/audit
// and ~/packages/Claude/notify.)
//
// AUTH — timestamp-bound HMAC, hardened per TE-16 (the verdict + email-report
// routes once shipped unsigned; a missing/forged/stale signature must 401):
//   - x-n8n-timestamp : unix-ms time (Date.now()), the freshness anchor.
//   - x-n8n-signature : HMAC_sha256(secret, `${timestamp}.${body}`) as lowercase
//     hex. Binds the EXACT body bytes AND the timestamp, so a captured request
//     can't be replayed outside the ±5-min window and the body can't be tampered.
//
// Time is ALWAYS injected by the caller (`ts`), never read inside buildRequest —
// so the request builder is pure and unit-testable offline (mirrors notify/audit:
// "this builder never calls Date.now itself"). Sign the EXACT string we POST: the
// hosted verifier re-stringifies the parsed body, so the JSON must round-trip
// byte-identical (it does here — a flat envelope of plain JSON values).

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const TRIGGER_SCHEMA = "studio.n8n-trigger.v1";
export const SIG_HEADER = "x-n8n-signature";
export const TS_HEADER = "x-n8n-timestamp";
export const MAX_SKEW_MS = 5 * 60 * 1000;

/** Hex HMAC-SHA256 of `body` under `secret`. The ONE signing primitive — shared
 *  with src/verify.mjs (inbound) so both directions agree byte-for-byte, and
 *  recomputed verbatim by the hosted n8n verify node (docs/n8n-verify-node.md). */
export function sign(body, secret) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Build the canonical signed request for an event. PURE — give it `ts`; it reads
 * no clock and performs no I/O, so a test asserts the signature deterministically.
 *
 * `event` is the logical trigger: `{ event:'task', payload:{ task_id, … } }`.
 * The envelope shape is the fixed contract the hosted workflow builds against.
 *
 * @param {{event?:string, payload?:object}} event
 * @param {{secret:string, ts:number}} cfg
 * @returns {{body:string, headers:Record<string,string>, payload:object}}
 */
export function buildRequest(event, cfg) {
  const timestamp = String(cfg.ts);
  const payload = {
    schema: TRIGGER_SCHEMA,
    event: event?.event ?? "trigger", // the workflow's event/router key
    payload: event?.payload ?? {},    // arbitrary structured data for the workflow
    sentAt: new Date(cfg.ts).toISOString(),
  };
  const body = JSON.stringify(payload);
  return {
    body,
    payload,
    headers: {
      "content-type": "application/json",
      [TS_HEADER]: timestamp,
      [SIG_HEADER]: sign(`${timestamp}.${body}`, cfg.secret),
    },
  };
}

/**
 * Resolve config from the environment, then (for keys still unset) an optional
 * ~/.claude/n8n-trigger.env fallback. NO secret ever lives in this package — it
 * is read from the process env or that chmod-600 file at call time.
 *
 * @returns {{url:string|undefined, secret:string|undefined}}
 */
export function loadConfig(env = process.env) {
  let url = env.N8N_WEBHOOK_URL;
  let secret = env.N8N_WEBHOOK_SECRET;
  if (!url || !secret) {
    const file = readEnvFile(join(homedir(), ".claude", "n8n-trigger.env"));
    url = url || file.N8N_WEBHOOK_URL;
    secret = secret || file.N8N_WEBHOOK_SECRET;
  }
  return { url, secret };
}

/** Parse a KEY=VALUE env file (#-comments, blank lines, optional quotes). Returns
 *  {} if the file is absent/unreadable — the fallback is best-effort, never fatal. */
function readEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * Fire an event at the hosted n8n workflow. Fail-SOFT by design: it resolves a
 * result object and NEVER throws on a transport error, so a user-facing flow can
 * never be blocked by a webhook outage (matches lib/n8n.ts: "a failed trigger
 * must not break the user-facing flow").
 *
 * No-ops cleanly when the URL or secret is unset — returns a loud not-wired
 * result (never a silent success), so the UI keeps working before the workflow
 * is provisioned.
 *
 * @param {{event?:string, payload?:object}} event
 * @param {{url?:string, secret?:string, ts?:number, timeoutMs?:number}} [cfg]
 * @returns {Promise<{ok:boolean, status:number, delivered:boolean, note:string}>}
 */
export async function trigger(event, cfg = {}) {
  const url = cfg.url ?? undefined;
  const secret = cfg.secret ?? undefined;
  if (!url || !secret) {
    return {
      ok: false,
      status: 0,
      delivered: false,
      note: "NOT WIRED — N8N_WEBHOOK_URL / N8N_WEBHOOK_SECRET absent. Nothing sent.",
    };
  }
  const ts = cfg.ts ?? Date.now();
  const { body, headers } = buildRequest(event, { secret, ts });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 5000);
  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
    // A 2xx means the n8n webhook ACCEPTED (and, with Respond-Immediately, queued)
    // the call. delivered tracks accept-vs-reject — it is never swallowed into a
    // silent success; a 401 here means the signature was rejected by the verifier.
    return {
      ok: res.ok,
      status: res.status,
      delivered: res.ok,
      note: res.ok ? "accepted by n8n webhook" : `n8n webhook rejected: HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      delivered: false,
      note: `transport error (not a rejection): ${err?.name === "AbortError" ? "timeout" : err?.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
