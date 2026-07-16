# packages/n8n-trigger — Hard Constraints

> Domain CLAUDE.md. Canonical for this package. The FOUNDATIONAL n8n seam: the
> generator reads this before any feature that triggers or verifies n8n.

## What this package is

The FIXED client-side seam for the hosted n8n integration: a server-only signed
caller (`src/client.mjs`) that fires a workflow webhook, and the matching inbound
verifier (`src/verify.mjs`) for the callbacks that workflow makes back. Every
other n8n feature reuses this — one signing scheme, both directions. Configured
per client via env (`N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`); never rebuilt.

## HARD constraints — the recurring boundary (baseline §8)

- **Webhook hooks ONLY.** This package holds the endpoints the workflows call and
  the verifier for their callbacks — never the workflows themselves. A workflow
  DEFINITION (graph, nodes, schedule, scraping/structuring logic) appearing in
  this repo is a boundary violation (reverse-gate B), not a build to retry. The
  `docs/n8n-verify-node.md` snippet is the client-side contract the hosted node
  satisfies; it is documentation of the seam, not a committed workflow.
- **The hosted n8n instance is the recurring revenue.** It is yours and never
  handed over. Do not rebuild the Tessera "n8n-as-backend / sole DB writer"
  mental model — here n8n is a separate hosted add-on the repo only *calls*.

## HARD constraints — auth (TE-16)

- **Always sign; sign `${timestamp}.${body}`.** HMAC-SHA256, lowercase hex, in
  `x-n8n-signature`, with unix-ms time in `x-n8n-timestamp`. Posting an unsigned
  trigger, or accepting an unsigned/forged/stale callback, is the TE-16 class and
  a hard finding.
- **±5-min replay window, constant-time compare.** Inbound verification rejects
  anything outside the skew or with a mismatched MAC → 401. The verifier fails
  CLOSED when unconfigured — never waves a caller through.
- **No secrets in files.** Config is read from env, then an optional chmod-600
  `~/.claude/n8n-trigger.env`. A secret committed to this package is a finding.
- **Fail-soft outbound, never throw.** A webhook outage must not break a
  user-facing flow: `trigger()` returns a result; it does not raise. No-ops loudly
  (`NOT WIRED`) when the URL/secret are unset — never a silent success.
- **Pure builder.** `buildRequest()` takes the caller's `ts` and performs no I/O,
  so the signature is deterministic and offline-testable.

## What the evaluator checks here

- No n8n workflow definition present (signed caller + verify snippet only).
- Outbound requests are signed over `${ts}.${body}`; inbound verify enforces HMAC
  + ±5-min skew with a constant-time compare and fails closed when unwired.
- No committed secret; Node built-ins only, no npm deps.
- `selftest.mjs` earns its pass (exits non-zero on any failed assertion).

## Tier gating

n8n feature flag off → this package ships but stays inert (`trigger()` no-ops
not-wired, no callback routes mounted) until the URL/secret are configured.
