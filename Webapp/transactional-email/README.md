# transactional-email — Resend send seam (report email + "email on done")

A self-contained, reusable feature-package: one fail-soft function —
`sendEmail(to, subject, html, { attachment })` — that **validates the recipient
server-side**, builds a Resend payload (with an optional base64 attachment), and
POSTs it to the **Resend REST API**. It is the single send seam behind two
callers of the same contract:

1. the in-app **"email me the report"** server action, and
2. the studio's hosted **"email on done"** n8n workflow node.

It is FIXED template scope, configured per client via env — never rebuilt. The
shape and discipline are lifted from Tessera's report sender
(`apps/web/app/(app)/tasks/[id]/extra-actions.ts → sendReport()`), generalised
into a shared, offline-testable module.

```
src/
  validate.mjs   PURE — validateRecipient() + EMAIL_RE; the server-side gate
  send.mjs       the seam — encodeAttachment()/buildPayload() (pure) + sendEmail() (fail-soft)
docs/
  n8n-email-on-done.md   reference snippet for the HOSTED workflow node (stays off the repo)
selftest.mjs     OFFLINE earned checks — no network, no creds
```

Node 22 built-ins only. No Resend SDK is vendored — the send is a plain `fetch`
to `https://api.resend.com/emails`. Same dependency-free discipline as the
studio's `notify` and `audit` packages.

## The contract

```js
import { sendEmail } from "@studio/transactional-email";

const res = await sendEmail(
  "owner@shop.example",            // recipient — validated server-side
  "Your report is ready",
  "<p>Your task finished. The file is attached.</p>",
  { attachment: { filename: "report.csv", content: csvString } }  // optional, raw bytes
);
// res === { sent: boolean, status: number, note: string }
```

- **`sent`** — `true` only on a 2xx from Resend (the email was accepted).
- **`status`** — the HTTP status, or `0` for not-wired / bad-recipient / transport miss.
- **`note`** — a short, safe-to-surface reason (never contains the key).

**Fail-soft by design.** A missing key, a malformed recipient, a non-2xx, or a
transport error all RESOLVE a result — `sendEmail` never throws. A caller wired
into a server action or a workflow node can never be blocked by an email outage.
This mirrors Tessera's `sendReport()` returning `{ ok: false, error }` instead of
crashing the task surface.

## Two pure parts, one impure part

- `validateRecipient(to)` and `EMAIL_RE` (`src/validate.mjs`) — the server-side
  shape gate. Pure, no I/O.
- `encodeAttachment(att)` and `buildPayload({...})` (`src/send.mjs`) — base64
  encode + exact Resend body. Pure, deterministic.
- `sendEmail(...)` — the ONLY part that reads env and calls `fetch`.

Because the pure parts read no clock, env, or network, `selftest.mjs` asserts
validation (accept + reject), payload shape (incl. the attachment), and the
fail-soft / not-wired path entirely offline.

## Config (env, with a file fallback — no secrets in this package)

Resolved first-hit-wins: explicit override → `process.env` →
`~/.claude/transactional-email.env` (KEY=VALUE lines, `chmod 600`, gitignored).

| Key                         | Purpose                                            |
|-----------------------------|----------------------------------------------------|
| `RESEND_REPORTING_API_KEY`  | Resend API key, **send-only scope**. Required.     |
| `EMAIL_FROM`                | The verified `From` address. Required.             |

```bash
# ~/.claude/transactional-email.env   (chmod 600 — never committed)
RESEND_REPORTING_API_KEY=re_xxx_send_only
EMAIL_FROM=Tessera <reports@tessera-project.dev>
```

With either value unresolved, `sendEmail` is a **loud not-wired no-op**
(`{ sent: false, status: 0, note: "NOT WIRED — ..." }`) — never a silent success.

## The recurring boundary

The package ships the **send seam** and a **doc** of the on-completion node
(`docs/n8n-email-on-done.md`). The "email on done" **workflow itself stays hosted
on the studio's n8n instance** and never enters a client repo — same boundary the
studio holds for every hosted add-on (`packages/integrations`, baseline §8). The
repo gets the seam the workflow calls; the workflow definition is studio infra,
not a client deliverable.

## Selftest

```sh
node selftest.mjs        # offline; exits 0 only if every assertion holds
```

It forces the Resend key absent for the not-wired check (a real negative
control), passes an exploding `fetchImpl` to prove no send is attempted on the
not-wired / bad-recipient paths, and uses a fake `fetch` to assert the POST
request shape — all without touching the network.

## Boundary

OUTBOUND transactional send only. Inbound email parsing, template/brand authoring,
deliverability (SPF/DKIM/DMARC) and Resend domain verification are out of scope —
the seam assumes a verified sending domain and a send-only key already exist.
