# n8n node — "email on done" (the recurring boundary)

The transactional-email package ships the **send seam**; the on-completion
workflow node that *calls* it stays **hosted on the studio's n8n instance** and
never enters a client repo. This is the same recurring boundary the studio holds
for every hosted add-on (baseline §8, `packages/integrations`): the client repo
gets the hook/seam; the workflow DEFINITION lives server-side and is the
recurring revenue. This file is the **reference snippet** for that hosted node —
documentation, not a committed workflow.

## Where the seam fits

```
task finishes ──▶ [hosted n8n: "email on done" workflow] ──▶ POST https://api.resend.com/emails
                          │                                          (same payload buildPayload() produces)
                          └─ reads the latest output + recipient, builds {to,subject,html,attachment}
```

Two callers, one contract:

- **In-app** — the "email me the report" server action calls
  `sendEmail(to, subject, html, { attachment })` directly (see Tessera's
  `apps/web/app/(app)/tasks/[id]/extra-actions.ts → sendReport()`).
- **Hosted** — the n8n "email on done" node fires the *same* request shape when a
  scheduled run completes with `email_on_done = true`.

## Reference node (hosted — do NOT commit a `*.workflow.json` to a client repo)

An HTTP Request node that reproduces `buildPayload()` + the send headers. The key
is the **send-only** `RESEND_REPORTING_API_KEY`, held as an n8n credential, never
in the repo:

```json
{
  "name": "Email report on done",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://api.resend.com/emails",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": { "parameters": [
      { "name": "Content-Type", "value": "application/json" }
    ] },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ from: $env.EMAIL_FROM, to: $json.recipient, subject: 'Your report is ready', html: $json.html, attachments: $json.attachment ? [ { filename: $json.attachment.filename, content: $json.attachment.content } ] : undefined }) }}"
  },
  "credentials": {
    "httpHeaderAuth": { "name": "Resend (RESEND_REPORTING_API_KEY, send-only)" }
  }
}
```

Notes that keep it honest:

- **Recipient is validated upstream.** The node should only ever receive a
  recipient that already passed `validateRecipient()` (run it in a preceding
  Function/Code node, or gate the send). The seam validates again in-app; the
  hosted path must not skip it.
- **`attachments[].content` is base64** — exactly what `encodeAttachment()`
  emits. The hosted node expects the upstream step to have base64-encoded the
  file, same as the in-app path.
- **Send-only scope.** `RESEND_REPORTING_API_KEY` is a Resend key restricted to
  sending. It lives as an n8n credential and in `~/.claude/transactional-email.env`
  for the in-app path — never in any committed file.
- **Fail-soft.** A non-2xx from Resend must not fail the workflow run loudly to
  the client; log it and move on, matching the in-app seam's `{sent:false}`
  no-throw contract.

## Boundary restated

The package = the send seam (`src/send.mjs`) + this doc. The hosted workflow that
schedules and triggers the send is studio infra; it is not a client deliverable
and its definition does not live here.
