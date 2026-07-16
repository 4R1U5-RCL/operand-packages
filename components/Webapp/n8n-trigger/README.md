# n8n-trigger — the signed n8n webhook seam

A self-contained, reusable feature-package: the **server-only** client that fires
a hosted n8n workflow webhook with a **timestamped HMAC-SHA256 signature**, plus
the matching **inbound verifier** for the callbacks that workflow makes back to
the app. This is the **foundational seam** every other n8n feature reuses — they
trigger and verify *through* this one module, so the whole stack shares a single
signing scheme.

> The n8n workflow **definition** stays hosted on the studio's n8n instance and
> never enters this (or any client) repo. This package is the client-side signed
> caller + the matching verify-node snippet only (recurring boundary, baseline §8).

```
src/client.mjs          buildRequest() (pure) + trigger() (fetch, fail-soft) + loadConfig()
src/verify.mjs          verify() — inbound HMAC + ±5-min replay guard, constant-time
docs/n8n-verify-node.md copy-paste n8n Code-node snippet that 401s unsigned/forged/stale
selftest.mjs            offline earned checks (no network, no creds)
```

## Auth — timestamp-bound HMAC (both directions, one primitive)

Sign `${timestamp}.${body}` with HMAC-SHA256 (lowercase hex); send it as
`x-n8n-signature` with the unix-ms time in `x-n8n-timestamp`. The timestamp binds
freshness (±5-min skew) and is folded into the MAC so a captured request can't be
replayed or tampered. `src/client.mjs` produces it outbound; `src/verify.mjs`
checks the identical string inbound; `docs/n8n-verify-node.md` recomputes the same
on the hosted side. This is the TE-16 hardening (the routes that once shipped
unsigned) made reusable — a missing, forged, or stale signature is **401**.

## Use — outbound trigger

```js
import { trigger, loadConfig } from "./src/client.mjs";

const cfg = loadConfig();                 // env, then ~/.claude/n8n-trigger.env
const res = await trigger(
  { event: "task", payload: { task_id } },
  cfg,                                    // { url, secret }
);
// res => { ok, status, delivered, note }
```

`trigger()` is **fail-soft**: it never throws. A transport error or timeout
returns `delivered:false` with a `note`, so a user-facing flow can't be blocked by
a webhook outage. When `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` are unset it
**no-ops cleanly** — a loud `NOT WIRED` result, never a silent success — so the UI
works before the workflow is provisioned.

`buildRequest(event, { secret, ts })` is **pure**: the caller injects `ts`, it
reads no clock and does no I/O, so the signature is deterministic and the whole
envelope is unit-testable offline.

## Use — inbound callback verifier

```js
import { verify } from "./src/verify.mjs";

// In an n8n-callback route, over the RAW request body:
const v = verify(rawBody, req.headers, { secret: process.env.N8N_WEBHOOK_SECRET });
if (!v.ok) return res.status(v.status).end();   // 401 on unsigned/forged/stale
```

Verify over the **raw** body bytes (not a re-stringified object) so the MAC
matches. `verify()` fails **closed** when no secret is configured — it never waves
a caller through.

## Config (env, no secrets in files)

```bash
# ~/.claude/n8n-trigger.env   (chmod 600 — read only as a fallback)
N8N_WEBHOOK_URL=https://<studio-n8n-host>/webhook/<path>
N8N_WEBHOOK_SECRET=<secret>
```

Resolution order: `process.env` first, then this file for any key still unset. No
secret is ever stored in the package.

## Prove it

```bash
node selftest.mjs   # signature determinism, key/timestamp binding, replay/stale
                    # rejection, fail-soft not-wired — exits non-zero on any failure
```

## Boundary

Hooks only. The signed caller and the verify-node snippet live here; the workflow
graph, schedule, and logic are hosted studio infrastructure and are never
committed. Node 22 built-ins only — no npm deps.
