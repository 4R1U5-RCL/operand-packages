// transactional-email/src/validate.mjs — server-side recipient validation.
//
// The ONE place a caller-supplied recipient is judged before it is allowed near
// the Resend API. Pure, Node-22 built-ins only, no I/O — so the gate is unit-
// testable offline and identical for every caller (the in-app "email me the
// report" action AND the hosted "email on done" workflow node both go through
// it). Mirrors the server-side check Tessera's sendReport() does inline
// (apps/web/app/(app)/tasks/[id]/extra-actions.ts), lifted into a shared seam.

/**
 * Pragmatic email shape check. Deliberately a structural gate, not RFC-5322:
 * non-empty local part, a single `@`, a dotted domain, no whitespace. This is a
 * server-side guard against obviously-bad / injected input, not an existence
 * proof — only a real send can prove deliverability.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a single caller-supplied recipient.
 *
 * PURE — trims, shape-checks, and reports. No fallback to an account email lives
 * here (that is caller policy); this just answers "is this a usable address?".
 *
 * @param {unknown} to  the candidate recipient
 * @returns {{valid:boolean, recipient:string|null, error:string|null}}
 */
export function validateRecipient(to) {
  if (typeof to !== "string") {
    return { valid: false, recipient: null, error: "No recipient supplied." };
  }
  const recipient = to.trim();
  if (!recipient) {
    return { valid: false, recipient: null, error: "No recipient supplied." };
  }
  if (recipient.length > 254) {
    // Practical upper bound (RFC-5321 address length) — reject pathological input
    // before it ever reaches the API.
    return { valid: false, recipient: null, error: "That email address looks invalid." };
  }
  if (!EMAIL_RE.test(recipient)) {
    return { valid: false, recipient: null, error: "That email address looks invalid." };
  }
  return { valid: true, recipient, error: null };
}
