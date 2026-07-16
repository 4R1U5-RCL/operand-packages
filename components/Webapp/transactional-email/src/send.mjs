// transactional-email/src/send.mjs — the transactional-email SEND seam.
//
// One thin, dependency-free function — sendEmail(to, subject, html, {attachment})
// — that validates the recipient, builds the Resend payload (optionally with a
// base64 attachment), and POSTs it to the Resend REST API. It backs BOTH callers
// of the same contract: the in-app "email me the report" server action AND the
// studio's hosted "email on done" n8n workflow node (docs/n8n-email-on-done.md).
//
// Node 22 built-ins only. No SDK vendored — the send is a plain `fetch` to
// https://api.resend.com/emails (same discipline as ~/Claude/notify and audit).
//
// FAIL-SOFT by design (mirrors Tessera's sendReport): a missing API key, a bad
// recipient, or a non-2xx response all RESOLVE a result object — this never
// throws. The "delivered vs not / not-wired" distinction is carried in the
// result, never swallowed into a silent success.
//
// The pure parts — validateRecipient (../src/validate.mjs), encodeAttachment, and
// buildPayload — read no clock, env, or network, so they are asserted offline in
// selftest.mjs. Only sendEmail() touches env + fetch.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { validateRecipient } from "./validate.mjs";

export const RESEND_ENDPOINT = "https://api.resend.com/emails";

// ── tiny KEY=VALUE loader for ~/.claude/transactional-email.env (no deps) ─────
// Lets the send-only Resend key live OUTSIDE any committed file and outside the
// shell env. Same loader shape as notify's ~/.claude/notify.env. An absent file
// is fine — process.env may carry the values instead.
function loadEnvFile(path) {
  const out = {};
  try {
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[k] = v;
    }
  } catch { /* absent file is fine */ }
  return out;
}

/**
 * Resolve config in order, first hit wins: explicit override → process.env →
 * ~/.claude/transactional-email.env. NO secret is ever stored in this package.
 *
 * @param {{apiKey?:string, from?:string}} [override]
 * @returns {{apiKey:string|undefined, from:string|undefined}}
 */
export function resolveConfig(override = {}) {
  const fileEnv = loadEnvFile(join(homedir(), ".claude", "transactional-email.env"));
  const pick = (key) => process.env[key] ?? fileEnv[key];
  return {
    apiKey: override.apiKey ?? pick("RESEND_REPORTING_API_KEY"),
    from: override.from ?? pick("EMAIL_FROM"),
  };
}

/**
 * Encode an optional attachment to the Resend wire shape. PURE.
 *
 * Input  {filename, content}  — content is raw bytes (string or Buffer/Uint8Array).
 * Output {filename, content}  — content base64-encoded, as Resend expects.
 *
 * Returns null for a falsy/invalid attachment so buildPayload can simply omit it.
 *
 * @param {{filename?:string, content?:string|Buffer|Uint8Array}|null|undefined} att
 * @returns {{filename:string, content:string}|null}
 */
export function encodeAttachment(att) {
  if (!att || typeof att !== "object") return null;
  const { filename, content } = att;
  if (!filename || content == null) return null;
  const buf = Buffer.isBuffer(content)
    ? content
    : content instanceof Uint8Array
      ? Buffer.from(content)
      : Buffer.from(String(content), "utf-8");
  return { filename: String(filename), content: buf.toString("base64") };
}

/**
 * Build the canonical Resend request body. PURE — no env, clock, or I/O. A test
 * can assert the exact shape (including the encoded attachment) deterministically.
 *
 * @param {{from:string, to:string, subject:string, html:string,
 *          attachment?:{filename:string, content:string|Buffer}|null}} input
 * @returns {{from:string, to:string, subject:string, html:string,
 *            attachments?:Array<{filename:string, content:string}>}}
 */
export function buildPayload({ from, to, subject, html, attachment } = {}) {
  const payload = {
    from,
    to,
    subject: subject ?? "",
    html: html ?? "",
  };
  const encoded = encodeAttachment(attachment);
  if (encoded) payload.attachments = [encoded];
  return payload;
}

/**
 * Send a transactional email through Resend. FAIL-SOFT: always resolves a result,
 * never throws. The shape is `{sent, status, note}`:
 *   - sent   — true only on a 2xx from Resend (the email was accepted).
 *   - status — the HTTP status, or 0 for a not-wired / pre-flight / transport miss.
 *   - note   — a short human reason (safe to surface; never contains the key).
 *
 * Recipient is validated server-side (../src/validate.mjs) before anything is
 * sent. With no RESEND_REPORTING_API_KEY resolvable, it is a LOUD not-wired no-op
 * — never a silent success.
 *
 * @param {string} to        recipient address (validated here)
 * @param {string} subject
 * @param {string} html
 * @param {{attachment?:{filename:string, content:string|Buffer}|null,
 *          from?:string, apiKey?:string, fetchImpl?:Function, timeoutMs?:number}} [opts]
 * @returns {Promise<{sent:boolean, status:number, note:string}>}
 */
export async function sendEmail(to, subject, html, opts = {}) {
  // 1. Validate the recipient before touching config or network.
  const v = validateRecipient(to);
  if (!v.valid) {
    return { sent: false, status: 0, note: v.error };
  }

  // 2. Resolve config. No key → not wired → loud no-op (never throws/sends).
  const { apiKey, from } = resolveConfig({ apiKey: opts.apiKey, from: opts.from });
  if (!apiKey) {
    return {
      sent: false,
      status: 0,
      note: "NOT WIRED — RESEND_REPORTING_API_KEY absent (env or ~/.claude/transactional-email.env). Nothing sent.",
    };
  }
  if (!from) {
    return { sent: false, status: 0, note: "NOT WIRED — EMAIL_FROM absent. Nothing sent." };
  }

  // 3. Build the payload (pure) and POST it. Any transport error is caught and
  //    reported as a result, never thrown.
  const payload = buildPayload({ from, to: v.recipient, subject, html, attachment: opts.attachment });
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await doFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return {
      sent: res.ok,
      status: res.status,
      note: res.ok ? "accepted by Resend" : `Resend rejected: HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      sent: false,
      status: 0,
      note: `transport error (not a rejection): ${err?.name === "AbortError" ? "timeout" : err?.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
