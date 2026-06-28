#!/usr/bin/env node
// scripts/selftest.mjs — OFFLINE earned checks for the seam (no network, no creds).
//
// Proves the pure parts actually behave before any live wiring exists: signature
// determinism, header/envelope shape, single-secret fallback, and the fail-soft
// not-wired path. Exits 0 only if every assertion holds (a real green, not a
// "ran without error"). Run: node scripts/selftest.mjs

import assert from "node:assert/strict";
import { buildRequest, notify, sign, NOTIFY_SCHEMA, TOKEN_HEADER, SIG_HEADER, TS_HEADER } from "../src/client.mjs";

let n = 0;
const ok = (name) => { n++; process.stdout.write(`  ✓ ${name}\n`); };

// 1. sign() is a stable HMAC-SHA256 hex digest.
{
  const s = sign("123.{}", "secret");
  assert.match(s, /^[0-9a-f]{64}$/);
  assert.equal(s, sign("123.{}", "secret"));     // deterministic
  assert.notEqual(s, sign("123.{}", "other"));   // key-sensitive
  ok("sign() deterministic, hex, key-sensitive");
}

// 2. buildRequest() is pure for a fixed ts, and the signature covers `${ts}.${body}`.
{
  const ev = { source: "claude-code", kind: "attention", message: "hi", ts: 1_700_000_000_000 };
  const r1 = buildRequest(ev, { token: "tok" });
  const r2 = buildRequest(ev, { token: "tok" });
  assert.equal(r1.body, r2.body);
  assert.equal(r1.headers[SIG_HEADER], r2.headers[SIG_HEADER]);
  assert.equal(r1.payload.schema, NOTIFY_SCHEMA);
  assert.equal(r1.headers[TOKEN_HEADER], "tok");
  assert.equal(r1.headers[TS_HEADER], "1700000000000");
  assert.equal(r1.headers[SIG_HEADER], sign(`1700000000000.${r1.body}`, "tok"));
  ok("buildRequest() pure; signature binds timestamp+body");
}

// 3. secret defaults to token, but an explicit secret overrides (two-secret mode).
{
  const ev = { source: "audit", message: "x", ts: 1 };
  const a = buildRequest(ev, { token: "tok" });
  const b = buildRequest(ev, { token: "tok", secret: "different" });
  assert.notEqual(a.headers[SIG_HEADER], b.headers[SIG_HEADER]);
  ok("explicit secret overrides token for HMAC");
}

// 4. notify() with no url/token is fail-soft not-wired — never throws, never a
//    silent success.
{
  const res = await notify({ source: "claude-code", message: "x" }, {});
  assert.equal(res.delivered, false);
  assert.equal(res.ok, false);
  assert.match(res.note, /NOT WIRED/);
  ok("notify() fail-soft + loud when not wired");
}

process.stdout.write(`\nselftest: ${n} checks passed\n`);
