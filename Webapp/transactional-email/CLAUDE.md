# transactional-email — Hard Constraints

> Domain CLAUDE.md. Canonical for this feature-package. The generator reads this
> before touching transactional-email.

## What this package is

The FIXED transactional-email **send seam**: one fail-soft function
`sendEmail(to, subject, html, { attachment })` that validates the recipient,
builds a Resend payload, and POSTs it to the Resend REST API. Built once,
configured per client via env — never rebuilt. It backs two callers of the same
contract: the in-app "email me the report" action and the hosted "email on done"
n8n node.

## HARD constraints

- **Fail-soft, never throws.** Every path — bad recipient, missing key, non-2xx,
  transport error — RESOLVES `{ sent, status, note }`. A throw from this seam is a
  TEMPLATE GAP (it could block a server action or a workflow run), not a build
  task. Mirrors Tessera's `sendReport()` returning a result, never crashing the
  task surface.
- **Recipient is validated server-side.** Caller-supplied addresses pass through
  `validateRecipient()` before any send. Skipping the gate on any path (including
  the hosted node) is a finding.
- **No secrets in files.** `RESEND_REPORTING_API_KEY` (send-only scope) and
  `EMAIL_FROM` come from env or `~/.claude/transactional-email.env` — never a
  committed file. A key appearing in this package is a boundary finding. Keys are
  send-scoped; over-scoping is a finding.
- **No SDK vendored, no npm deps.** The send is a plain `fetch` to
  `https://api.resend.com/emails`. Node-22 built-ins only (`node:crypto`-free;
  `node:fs`/`node:os`/`node:path` for the env fallback, global `fetch`).
- **Pure parts stay pure + offline-testable.** `validateRecipient`,
  `encodeAttachment`, and `buildPayload` read no env, clock, or network, so
  `selftest.mjs` earns its pass offline. Only `sendEmail` touches env + fetch.

## The recurring boundary (baseline §8)

The "email on done" **workflow stays hosted** on the studio's n8n instance and
never enters a client repo. This package ships the **send seam** the node calls,
plus `docs/n8n-email-on-done.md` documenting that node — NOT the workflow
definition. A committed `*.workflow.json` for the on-done flow here is a boundary
violation (reverse-gate B), not a build to retry.

## What the evaluator checks here

- `sendEmail` never throws on any input; not-wired is a loud no-op, not a silent pass.
- Every send path runs the recipient through `validateRecipient()`.
- No Resend key or other secret committed; scope is send-only.
- No Resend SDK / npm dependency; send is a `fetch` to the documented endpoint.
- No hosted "email on done" workflow definition present (seam + doc only).
- `selftest.mjs` asserts validation accept/reject, payload shape incl. attachment,
  and the fail-soft/not-wired path — and exits non-zero if any stops holding.

## What stays human (back gate)

Email copy/brand voice and the decision to verify a sending domain. The evaluator
checks the seam is wired and fail-soft; whether the message reads right for the
client is the human review at the back gate.
