# telegram-triage — `[triage_plugin]` (ADD-ON — reusable verdict layer)

A reusable human-in-the-loop **verdict layer** over a Telegram inline-button
callback. A caller (Radar, Vouch, Rekindle, an SEO-PR flow) sends an item to
Telegram via the shared `triageKeyboard` helper; when the operator taps a button
this receiver dual-authenticates the callback and `PATCH`es the pressed verdict
back to the **caller's own** write-table slot, on the caller's business-key columns.
The extracted-and-generalised `dirnotif-feedback` — every dirnotif-specific literal
lifted to a slot. It owns **no table of its own** (SPEC §3 D-0): it writes the
caller's slot table, never a triage-owned template. An internal ops rail, not a
site-facing product — the human gate other bricks bolt on. Full design:
`SPEC_operand-telegram-triage_2026-07-16.md`.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components (existing shapes it reuses)

| Component | Role |
|---|---|
| `n8n/workflows/signed-webhook-base.json` | The dual-mode HMAC verify → 401 gate → signed respond skeleton. The receiver's own dual-auth classifier (our HMAC canary vs. the Telegram bot-secret header) extends this base. |
| `n8n/workflows/outbound-verdict-callback.json` | The push → read verdict → map → write-back shape — the closest existing analogue to "read the pressed verdict, map it, PATCH it onto the caller's row". |
| `n8n/workflows/notification-fanout.json` | The channel-parameterised Telegram delivery leg — how the caller emits the inline-button prompt this receiver answers. *(SHARED with community-lead-radar, seo-improver, scheduled-digest.)* |

## Planned components (do NOT exist in the repo yet)

See `planned[]` in [`brick.json`](brick.json):

- The `triage-receiver` workflow builder — the generalized dual-auth callback
  receiver with the allow-list gate, the `Assert One Row` guard, and the
  caller-supplied `ACTION_MAP`; not yet snapshotted (mapped to the shapes above).
- The `triageKeyboard` compose-side primitive — the callback-data emitter a caller
  uses, sharing one buttons config with the receiver's `ACTION_MAP`.
- **No table** — v1 owns zero `tmpl_` tables (D-0); it writes the caller's slot.
