# sms-lead-qualifier — `[sms_plugin]` (BASE brick)

A rule-based n8n system that receives inbound SMS leads, verifies and deduplicates
them, honours opt-outs by construction, and answers in seconds — around the clock.
Two workflows: a fast inbound path that answers, and a small decision child. A base
brick other packages (e.g. `llm-lead-enrichment`) stack onto through its declared
async-dispatch seam.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/sms-state-machine.json` | The brick's shape: inbound → STOP/dedupe guards → identity/session lookup → decision → outbound + provider flag ([SCARLET] lineage). |
| `n8n/workflows/signed-webhook-base.json` | Base webhook skeleton every inbound seam extends — HMAC verify, signed responses, 401 fail-closed. *(SHARED with email-lead-qualifier.)* |
| `Webapp/n8n-trigger` | The signed-webhook seam a client surface uses to reach the hosted workflow (the studio↔client hook side). |
| `supabase/templates/per-user-owned.sql` | Generic per-key-owned session-state shape — every conversation is a row keyed to the phone number. *(Stand-in for the brick's own `tmpl_*` session table, which lives in `studio/templates`, not this repo.)* |
