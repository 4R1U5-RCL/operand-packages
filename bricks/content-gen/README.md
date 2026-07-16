# content-gen — `[content_gen_plugin]` (BASE brick)

SEO-suite brick #7, the SERP-grounded content-brief generator. A
webhook-triggered n8n system: verify the signed request, ack fast, then work
behind the ack — pull the live Google SERP for the target keyword, extract the
ranking landscape (top-ranking titles/urls, on-page structure hints,
entities/terms, SERP features → intent) as the GROUNDING, and hand those facts
to a fail-open LLM generation seam that drafts a brief (recommended title/meta,
H2/H3 outline, entities to cover, target intent, word-count + internal-link
guidance). The brief is DRAFT-FIRST — a human reviews it, it is never
auto-published — and its structure traces to the SERP facts (the prompt forbids
inventing rankings). Unlike the detection bricks the LLM seam is the value here,
but it KEEPS the fail-open pattern: no bound generation child → an honest "brief
pending (no generation model bound)" placeholder row still lands, so the table /
stable id / notify machinery all work. An empty/errored SERP is recorded
honestly, never a fabricated brief. The metered SERP pull is bounded by the
shared daily spend gate. A base brick the SEO-audit orchestrator can compose.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/content-gen.json` | The brick's own workflow: webhook → dual HMAC verify → 401 gate → signed 202 ack → spend guard → DataForSEO SERP (object-first, honest-empty) → grounding (top-ranking titles / entities / features / intent) → stable `BRIEF-<hex>` id → fail-open LLM (`executeWorkflow` Generate Brief; honest placeholder when unbound) → UPSERT the DRAFT-FIRST content-briefs ledger → signed notify. |
| `Webapp/spend-gate` | Hard daily spend cap on the metered DataForSEO SERP pull — the shared `global_send_quotas` counter + gate. *(SHARED with keyword-research, technical-audit, content-tracker, competitor-gap, backlinks, seo-improver, seo-audit-orchestrator.)* |
| `supabase/templates/content-gen.sql` | The brick-exclusive `tmpl_seo_content_briefs` ledger — DRAFT-FIRST SERP-grounded content briefs (status `draft`→`approved`/`used`/`discarded`), service-role-only, `on_conflict (tenant, brief_id, run_date)` for idempotent re-runs. |
