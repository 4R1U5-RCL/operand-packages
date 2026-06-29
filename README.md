# packages — reusable studio tooling

Standalone, reusable tooling that serves the studio but isn't part of any single
client build or the harness. Each package is self-contained and is **consumed by
pulling a pinned version**, never copy-forked into a container.

## Packages

| Package | What it is |
|---------|------------|
| [`audit/`](audit/) | ATT&CK × ISO 27001 × SOC 2 security verification for the studio stack — a deterministic check core with three entry points (agent skill, CI gate, scheduled runner). Every check is self-guarded so a pass is earned, never assumed. |
| [`notify/`](notify/) | Claude Code → Telegram notifier. A `Notification`/`Stop` hook POSTs a signed event to the hosted `[STUDIO_NOTIFICATION]` n8n workflow, which pings Telegram (🟡 needs input / 🟢 done). Header-Auth + HMAC-signed; the live channel is proven via the n8n executions API, never assumed. |
| [`n8n/`](n8n/) | Reusable n8n **workflow templates** for the hosted instance — 10 importable node-graph patterns (signed webhook, read API, notification fan-out, schedule dispatcher, LLM pipeline, orchestrator routing, email report, verdict callback, Shopify re-read, SMS state machine). Distilled from the live workflows; ship inactive with unbound credential slots. Exported from the `PACKAGE/Templates` n8n project. |

## Conventions

- **Self-contained.** A package lives entirely under its own directory; nothing it
  needs sits elsewhere in the tree.
- **Pinned consumption.** Consumers pull a tagged version and reference it in
  place. Bump the pin deliberately. (The first tag is `v0.1.0`.)
