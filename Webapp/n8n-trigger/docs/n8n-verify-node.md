# n8n verify node — reject unsigned / forged / stale calls (→ 401)

The hosted workflow's webhook must authenticate the app's trigger exactly as the
app authenticates the workflow's callbacks: **same HMAC, same headers, same
±5-min window** (TE-16). Drop this **Code node** immediately after the **Webhook**
node, then route its `verified` flag through an **IF** node to a **Respond to
Webhook** node that returns **401** when verification fails.

This lives here as the matching client-side snippet only — the workflow itself is
studio infra and is not committed (recurring boundary). Copy-paste into the node.

## Webhook node settings

- **HTTP Method:** POST
- **Authentication:** None (the HMAC below IS the auth — do not also rely on n8n
  Header Auth for this seam).
- **Options → Raw Body:** **ON.** The signature covers the *exact* bytes the app
  sent; verifying against a re-serialized object will mismatch. The raw body is
  exposed at `items[0].binary.data` (base64) or, with "Raw Body" on, as a string
  field — read it as a string and HMAC that string verbatim.

## Code node (Run Once for All Items)

```js
const crypto = require('crypto');

// Same secret the app signs with (N8N_WEBHOOK_SECRET). Store it as an n8n
// credential / env var — never inline it in the node.
const SECRET = $env.N8N_WEBHOOK_SECRET;
const MAX_SKEW_MS = 5 * 60 * 1000;

const item = items[0].json;
const headers = item.headers || {};
const ts = headers['x-n8n-timestamp'];
const sig = headers['x-n8n-signature'];

// The RAW request body string, byte-identical to what the app POSTed. With
// "Raw Body" enabled this is item.body as received; do NOT JSON.stringify a
// parsed object here.
const rawBody = typeof item.body === 'string'
  ? item.body
  : JSON.stringify(item.body); // fallback only — keep Raw Body ON to avoid this

function fail(reason) {
  // Surface a 401 downstream: route `verified === false` to a Respond-to-Webhook
  // node configured with Response Code 401. Throwing also halts the run.
  return [{ json: { verified: false, reason } }];
}

if (!ts) return fail('no-timestamp');
if (!sig) return fail('no-signature');

const tsNum = Number(ts);
if (!Number.isFinite(tsNum)) return fail('bad-timestamp');
if (Math.abs(Date.now() - tsNum) > MAX_SKEW_MS) return fail('stale'); // replay guard

const expected = crypto
  .createHmac('sha256', SECRET)
  .update(`${ts}.${rawBody}`)
  .digest('hex');

// Constant-time compare; unequal lengths are a mismatch (timingSafeEqual throws).
const a = Buffer.from(sig, 'hex');
const b = Buffer.from(expected, 'hex');
const okSig = a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
if (!okSig) return fail('signature-mismatch');

// Verified — pass the parsed event payload through to the rest of the workflow.
return [{ json: { verified: true, event: item.body } }];
```

## Wiring the 401

```
Webhook → Code (verify) → IF  {{ $json.verified }}
                            ├─ true  → … workflow continues …
                            └─ false → Respond to Webhook (Response Code 401)
```

A forged or stale call therefore never reaches a real node — it is rejected at
the edge with 401, the same verdict `src/verify.mjs` returns inbound. Prove it
before trusting it: send one correctly-signed call (expect 2xx) and one with a
mangled signature and one with a 10-minute-old timestamp (expect 401 each).
