---
name: verify-rotation
description: Post-rotation propagation check — run the secret-propagation ops-agent on-demand against a named key, with the IN-13 container-fingerprint guard; presence-only verdicts, never values
argument-hint: <KEY_NAME> [--project=<ref>]
allowed-tools: [Read, Bash, Grep]
user-invocable: true
---

# verify-rotation

Run AFTER executing a secret rotation's fan-out writes, in the same main session,
to check the rotation *propagated*. Companion to `/diagnose-secret` (which asks
"why does this secret 401?"; this asks "did the new value land everywhere?").

This is the ON-DEMAND mode of the `secret-propagation` ops-agent — deliberately
NOT on the queue rail (plan verdict 2026-07-02): scheduling it would put the
account-wide Supabase Management PAT on the device disk for near-zero drift
value, and queue rows can't carry WHICH key rotated. The agent's moment is
seconds after the rotation, here, with the right key name.

## What a verdict is worth (read before trusting output)

- **Presence booleans are STRUCTURE, not value** — the agent checks that a var
  of that NAME exists in each fan-out target. A green row is NOT evidence the
  NEW value landed (PAT-6 failure class). Treat "present everywhere" as
  "nothing obviously missing", never "rotation complete".
- **Trustworthy legs**: the ref-mismatch assertion (consumer URL vs
  Management-API ref) and the `/rest/v1/` auth probe — both network-side.
- **Known seam gaps** (until the next agent regenerate closes them): the n8n
  presence leg is hardcoded `false` (chronic "absent in: n8n" — ignore it, or
  check the n8n credential by hand); `vercel env ls` needs a `.vercel` project
  link in cwd or reports false-absent.

## Procedure

### 1. Parse args

- `<KEY_NAME>` (required): the rotated variable name, e.g. `GITHUB_FG_PAT_TOKEN`,
  `SUPABASE_SERVICE_ROLE_KEY`. If absent, list recently-rotated candidates from
  the session and ask — do not guess.
- `--project=<ref>`: target Supabase project; default `$SUPABASE_STAGING_PROJECT_REF`.

### 2. IN-13 fingerprint guard (BEFORE trusting any file read)

The container's `/studio/.env` can desync from the host copy (IN-13, OPEN). If
the user says they just edited it, prove the edit landed IN-CONTAINER:

```bash
stat -c 'mtime: %y' /studio/.env
sha256sum /studio/.env | cut -c1-16   # fingerprint prefix only — output is safe
```

- mtime older than the claimed edit, or fingerprint unchanged from earlier in
  the session → **STOP**: the agent would verify a stale copy. Have the user
  re-copy/re-edit inside the container (or `sudo docker cp` the host file in)
  before proceeding.

### 3. Run the agent (mapped env, correct cwd)

The agent expects `SUPABASE_PROJECT_REF`/`SUPABASE_URL`, which `/studio/.env`
carries under different names — map, never rename the file's vars:

```bash
set -a; . /studio/.env 2>/dev/null; set +a
REF="${PROJECT_REF_ARG:-$SUPABASE_STAGING_PROJECT_REF}"
cd /studio/clients/_ops-agents
SUPABASE_PROJECT_REF="$REF" \
SUPABASE_URL="https://${REF}.supabase.co" \
PROPAGATION_KEY_NAME="<KEY_NAME>" \
npx tsx agents/secret-propagation.ts --dry-run
```

Notes: stderr of the env source stays suppressed (the line-82 class); the agent
never prints values by contract — if any output looks value-shaped, STOP and
treat it as a PAT-6 incident.

### 4. Interpret + report

```
verify-rotation: <KEY_NAME> @ <ref>
  ref-match:   <ok | MISMATCH — high, act>
  rest probe:  <HTTP status — 200 live / 401 old-or-bad key>
  presence:    vercel=<bool> env.local=<bool> n8n=<bool — SEAM STUB, ignore>
  deferred:    <the fanout:<target> checklist — targets still needing the write>
  caveat:      presence = structure only (IN-13); value-landing is proven by the
               rest probe + the consumer actually working, not by this table.
```

Any `high` finding (ref mismatch, non-2xx from a leg that should work) is the
headline, before the table.

## Constraints

- Read-only + dry-run always; the rotation itself and every fan-out write stay
  with the main session as guarded writes — this skill only VERIFIES.
- Never echo a secret value; presence/status/fingerprint-prefix only (PAT-6).
- Do not add the Management PAT or this workflow to the device rail — plan
  verdict stands (queue fallback exists but is degraded and pointless until
  the seam gaps close).

## Reference

- Agent: `/studio/clients/_ops-agents/agents/secret-propagation.ts` (generated —
  fix seams via `client.config.ts` expect + regenerate, never hand-edit).
- Registry: IN-13 (env desync), PAT-6 (value exposure), PAT-11 (secret 401 causes
  — `/diagnose-secret`).
- Plan record: session 2026-07-02 (secret-propagation arming plan, verdict §2).
