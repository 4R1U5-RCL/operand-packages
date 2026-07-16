# Claude/ — agent-side tooling for the studio

Tooling Claude Code uses to operate the studio. Two shapes live here, side by
side, each as its own subfolder with a `SKILL.md` entry point:

- **Code packages** — a deterministic check/run core (`run.mjs`, `checks/`,
  `manifests/`, fixtures, CI + scheduled callers) fronted by an agent-facing
  `SKILL.md`. Self-guarded: a `pass` is earned (its negative control fired),
  never assumed.
- **Prompt skills** — pure-prompt slash-commands (a single `SKILL.md`), each
  folding a documented error class (`PAT-*`) into a blocking preflight. These
  were previously mirrored under `.claude/commands/`; they now live as packaged
  subfolders alongside the code packages. See
  [`SKILLS-CHEATSHEET.md`](SKILLS-CHEATSHEET.md) for the full grid (args +
  guardrail each encodes).

## Code packages

| Package | What it is |
|---------|------------|
| [`audit/`](audit/) | ATT&CK × ISO 27001 × SOC 2 security verification for the studio stack — a deterministic check core with three entry points (agent skill, CI gate, scheduled runner). Every check is self-guarded so a pass is earned, never assumed. |
| [`hygiene/`](hygiene/) | Config/codebase hygiene across three pluggable profiles (`claude` home-tree relocation, `codebase` git-aware backup + junk-drift report, `llm-artifacts` transcript backup). `cleanup` drift detector + self-verifying `backup`; report-only on non-`claude` profiles. |
| [`consult/`](consult/) | Multi-model cross-validation — `research` + `validate` over one LiteLLM chain (base → GPT-5 → Gemini, optional Perplexity). A corroborated/HIGH verdict needs the tiers to have actually responded, else `unknown` — never a fabricated answer. |
| [`notify/`](notify/) | Claude Code → Telegram notifier. A `Notification`/`Stop` hook POSTs a signed event to the hosted `[STUDIO_NOTIFICATIONS]` n8n workflow, which pings Telegram (🟡 needs input / 🟢 done). Header-Auth + HMAC-signed. |

## Prompt skills

| Skill | What it does |
|-------|--------------|
| [`harness-app-class/`](harness-app-class/) | Scaffold a NEW harness app-class + wire every registration point so the pipeline recognizes it (Track A studio-ops template class vs Track B served-app class). |
| [`deploy-vercel/`](deploy-vercel/) | Take an already-built client app live on Vercel — confirms the real project ID, guards PAT-7/PAT-8. |
| [`db-migrate/`](db-migrate/) | Apply a Supabase migration over HTTPS (Management API) + verify the object landed AND every new table has RLS (PAT-5). |
| [`n8n-deploy/`](n8n-deploy/) | Push a workflow from `@studio/n8n-templates` to the hosted n8n instance (inactive by default); §8 boundary — never copies a definition into a client repo. |
| [`dependabot-triage/`](dependabot-triage/) | List, group, gate-on-CI, and batch-merge Dependabot PRs across 4R1U5-RCL (green patch/minor only; majors held). |
| [`ci-add-to-board/`](ci-add-to-board/) | Wire `actions/add-to-project` CI so new issues/PRs auto-add to a Projects board. |
| [`app-security-audit/`](app-security-audit/) | App-surface security audit (RLS + response headers + SCA) of a built client repo, via the `audit` package — sits upstream of the harness `verify` stage. |
| [`diagnose-secret/`](diagnose-secret/) | Diagnose a secret that looks right but 401s at runtime — narrows to one of the 4 PAT-11 causes; never echoes the value. |
| [`verify-rotation/`](verify-rotation/) | Post-rotation propagation check — runs the `secret-propagation` ops-agent on-demand against a named key (IN-13 container-fingerprint guard); presence-only verdicts, never values. Companion to `diagnose-secret`. |
