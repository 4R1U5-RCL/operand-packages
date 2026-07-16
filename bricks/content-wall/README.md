# content-wall — `[content_wall_plugin]` (BASE — generalized Wall of Love)

A content-**TYPE-parameterized** collect → moderate → publish machine: it captures
user-supplied content (`testimonial` / `review` / `qa` / `showcase`), runs an
optional **fail-open** LLM moderation pass, gates on **human** approval (a dashboard
or the Telegram Triage brick — the LLM never self-approves), and publishes approved
rows to an embeddable widget on the client's own site through a **security-barrier**
public-read view. It generalizes the shipped Vouch (`[testimonial_plugin]`) — its
service-role base table, `anon`-read via a `security_barrier` view, PII masking,
fail-open moderation, and human-only approval gate — into a parameterized primitive
family; Vouch becomes the first consumer instance (`type=testimonial`). Text-only in
v1. Full design: `SPEC_operand-content-wall_2026-07-16.md`.

> The `components/` folder here holds **assembled copies** of the components listed
> below, materialised from the top-level `components/` layer tree by
> `scripts/assemble-bricks.mjs` and kept in sync by the `brick-freshness` CI check.
> The manifest [`brick.json`](brick.json) is the source of truth; edit components in
> the top-level `components/` tree, not here.

## Components

| Component | Role |
|---|---|
| `n8n/workflows/signed-webhook-base.json` | The PRIVATE intake: dual-mode HMAC verify → 401 gate → signed 202 ack → insert-pending. Reachable ONLY by the `[public_form_gateway]` relay (which binds `content_type` server-side). |
| `n8n/workflows/llm-doc-pipeline-mono.json` | The fail-open moderation child: one JSON-only, spend-guarded LLM pass emitting `{moderation_score, themes, sentiment, flags}` with a TYPE-AWARE instruction. Unbound/error → skip; the LLM never sets `is_approved`/`is_featured`. *(SHARED shape with llm-lead-enrichment, community-lead-radar.)* |
| `n8n/workflows/notification-fanout.json` | Email-free owner notify (excerpt + scores, never the submitter's email) on a new needs-review row. *(SHARED with telegram-triage, scheduled-digest.)* |
| `Webapp/spend-gate` | Daily spend cap on the optional LLM moderation child. *(SHARED with llm-lead-enrichment, community-lead-radar, seo-improver.)* |
| `supabase/templates/security-barrier-view.sql` | **The publish shape** — a `service_role`-only base table + a tenant-scoped `security_barrier` view exposing ONLY approved/published, non-PII columns. `anon` reads the view, never the base. The exact isolation core Vouch proved. |

## Planned components (do NOT exist in the repo yet)

See `planned[]` in [`brick.json`](brick.json):

- The `content-wall-plugin` workflow builder — the type-parameterized capture →
  moderate → publish machine (private intake + fail-open moderation child).
- `tmpl_content_wall` — the brick-exclusive typed submission table (the
  `security-barrier-view.sql` snapshot shows its publish shape).
- `tmpl_content_wall_moderation_log` — the brick-exclusive approval audit table.
