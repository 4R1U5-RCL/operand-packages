# email-lead-qualifier — `[email_plugin]` (BASE brick)

A rule-based n8n system running on our own inbox: inbound email leads caught,
qualified HOT/WARM/COLD, the owner notified instantly, an honest acknowledgement
sent — with telemetry written back for every lead. One workflow from inbox to
acknowledgement, with a declared enrichment seam. A base brick other packages (e.g.
`llm-lead-enrichment`) stack onto.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `Webapp/inbound-email` | The email intake seam — Resend inbound webhook → Svix HMAC verify → fetch → forward (watches the hello@ inbox). |
| `Webapp/transactional-email` | `sendEmail(...)` via the Resend REST API — backs the honest acknowledgement send. |
| `n8n/workflows/email-report.json` | validate → compose → Resend `/emails` → log → respond — the honest-ack composer. *(SHARED with community-lead-radar's digest.)* |
| `n8n/workflows/signed-webhook-base.json` | Signed-webhook skeleton for the ingress/ack path + the fire-and-forget enrichment dispatch. *(SHARED with sms-lead-qualifier.)* |
| `supabase/templates/public-capture.sql` | Generic lead-capture shape (band/score/timestamps) — stand-in for the brick's own dedicated capture table in `studio/templates`. |
