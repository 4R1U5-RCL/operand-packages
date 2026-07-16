#!/usr/bin/env node
// selftest.mjs — OFFLINE earned checks for the seam (no network, no creds).
//
// Proves the pure parts actually behave before any live wiring exists: signature
// determinism + key-sensitivity, timestamp-binding, the fail-soft not-wired path,
// and that the inbound verifier accepts a fresh/valid call and REJECTS every
// forgery (unsigned, wrong-key, stale/replay, tampered body, length-mangled).
// Exits 0 only if every assertion holds (a real green, not "ran without error").
// Run: node selftest.mjs

import assert from "node:assert/strict";
import {
  buildRequest,
  trigger,
  sign,
  loadConfig,
  TRIGGER_SCHEMA,
  SIG_HEADER,
  TS_HEADER,
  MAX_SKEW_MS,
} from "./src/client.mjs";
import { verify } from "./src/verify.mjs";

let n = 0;
const ok = (name) => { n++; process.stdout.write(`  ✓ ${name}\n`); };

const TS = 1_700_000_000_000;
const SECRET = "test-secret";
const EVENT = { event: "task", payload: { task_id: "abc123" } };

// 1. sign() is a stable HMAC-SHA256 hex digest: deterministic + key-sensitive.
{
  const s = sign(`${TS}.{}`, SECRET);
  assert.match(s, /^[0-9a-f]{64}$/);
  assert.equal(s, sign(`${TS}.{}`, SECRET));        // deterministic
  assert.notEqual(s, sign(`${TS}.{}`, "other"));    // key-sensitive
  ok("sign() deterministic, hex, key-sensitive");
}

// 2. buildRequest() is pure for a fixed ts, and the signature binds `${ts}.${body}`.
{
  const r1 = buildRequest(EVENT, { secret: SECRET, ts: TS });
  const r2 = buildRequest(EVENT, { secret: SECRET, ts: TS });
  assert.equal(r1.body, r2.body);
  assert.equal(r1.headers[SIG_HEADER], r2.headers[SIG_HEADER]);
  assert.equal(r1.payload.schema, TRIGGER_SCHEMA);
  assert.equal(r1.payload.event, "task");
  assert.equal(r1.headers[TS_HEADER], String(TS));
  assert.equal(r1.headers[SIG_HEADER], sign(`${TS}.${r1.body}`, SECRET));
  ok("buildRequest() pure; signature binds timestamp+body");
}

// 3. Timestamp-binding: the SAME event at a different ts signs differently, so a
//    captured signature can't be lifted onto a fresh timestamp.
{
  const a = buildRequest(EVENT, { secret: SECRET, ts: TS });
  const b = buildRequest(EVENT, { secret: SECRET, ts: TS + 1 });
  assert.notEqual(a.headers[SIG_HEADER], b.headers[SIG_HEADER]);
  ok("signature is timestamp-bound (no cross-timestamp replay of the MAC)");
}

// 4. trigger() with no url/secret is fail-soft not-wired — never throws, never a
//    silent success.
{
  const noUrl = await trigger(EVENT, { secret: SECRET });
  const noSecret = await trigger(EVENT, { url: "https://x/y" });
  const noneEither = await trigger(EVENT, {});
  for (const res of [noUrl, noSecret, noneEither]) {
    assert.equal(res.delivered, false);
    assert.equal(res.ok, false);
    assert.equal(res.status, 0);
    assert.match(res.note, /NOT WIRED/);
  }
  ok("trigger() fail-soft + loud when not wired (url or secret absent)");
}

// 5. verify() accepts a correctly-signed, fresh inbound callback — the outbound
//    request its OWN client produced verifies inbound (one shared primitive).
{
  const { body, headers } = buildRequest(EVENT, { secret: SECRET, ts: TS });
  const res = verify(body, headers, { secret: SECRET, now: TS + 1000 });
  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  ok("verify() accepts a fresh, correctly-signed inbound call");
}

// 6. verify() rejects every forgery class → 401.
{
  const { body, headers } = buildRequest(EVENT, { secret: SECRET, ts: TS });

  // (a) unsigned — no signature header
  const unsigned = verify(body, { [TS_HEADER]: String(TS) }, { secret: SECRET, now: TS });
  assert.equal(unsigned.ok, false);
  assert.equal(unsigned.status, 401);
  assert.match(unsigned.reason, /no-signature/);

  // (b) no timestamp
  const noTs = verify(body, { [SIG_HEADER]: headers[SIG_HEADER] }, { secret: SECRET, now: TS });
  assert.equal(noTs.ok, false);
  assert.match(noTs.reason, /no-timestamp/);

  // (c) forged — signed with the wrong key
  const forged = verify(
    body,
    { [TS_HEADER]: String(TS), [SIG_HEADER]: sign(`${TS}.${body}`, "wrong-key") },
    { secret: SECRET, now: TS },
  );
  assert.equal(forged.ok, false);
  assert.match(forged.reason, /signature-mismatch/);

  // (d) tampered body — valid signature for the ORIGINAL body, body since changed
  const tampered = verify(body + " ", headers, { secret: SECRET, now: TS });
  assert.equal(tampered.ok, false);
  assert.match(tampered.reason, /signature-mismatch/);

  ok("verify() rejects unsigned / no-ts / wrong-key / tampered-body → 401");
}

// 7. Replay/stale: a signature older (or newer) than the ±5-min window is rejected,
//    even though it is otherwise perfectly valid.
{
  const { body, headers } = buildRequest(EVENT, { secret: SECRET, ts: TS });
  const justInside = verify(body, headers, { secret: SECRET, now: TS + MAX_SKEW_MS });
  assert.equal(justInside.ok, true); // boundary is inclusive

  const tooOld = verify(body, headers, { secret: SECRET, now: TS + MAX_SKEW_MS + 1 });
  assert.equal(tooOld.ok, false);
  assert.equal(tooOld.status, 401);
  assert.match(tooOld.reason, /stale/);

  const tooFuture = verify(body, headers, { secret: SECRET, now: TS - MAX_SKEW_MS - 1 });
  assert.equal(tooFuture.ok, false);
  assert.match(tooFuture.reason, /stale/);
  ok("verify() rejects stale/replayed calls outside the ±5-min window");
}

// 8. verify() fails CLOSED when unwired (no secret) — never waves a caller through.
{
  const { body, headers } = buildRequest(EVENT, { secret: SECRET, ts: TS });
  const res = verify(body, headers, {});
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.match(res.reason, /not-wired/);
  ok("verify() fails closed when no secret is configured");
}

// 9. loadConfig() reads from a given env first (no file dependency in the test).
{
  const cfg = loadConfig({ N8N_WEBHOOK_URL: "https://h/w", N8N_WEBHOOK_SECRET: "s" });
  assert.equal(cfg.url, "https://h/w");
  assert.equal(cfg.secret, "s");
  ok("loadConfig() resolves url+secret from the environment");
}

process.stdout.write(`\nselftest: ${n} checks passed\n`);
