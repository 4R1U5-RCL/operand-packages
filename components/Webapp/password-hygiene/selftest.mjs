#!/usr/bin/env node
// selftest.mjs — OFFLINE earned checks for password-hygiene (no network, no creds).
//
// Proves the rules + breach seam actually behave before any live wiring exists:
// short/weak rejected, strong accepted, a known-breached password flagged (via an
// INJECTED fixture range carrying its real SHA-1 suffix), and FAIL-OPEN when the
// breach lookup throws. Exits 0 only if every assertion holds — a real green, not
// a "ran without error". Run: node selftest.mjs

import assert from "node:assert/strict";
import { checkPasswordStrength, sha1Prefix, MIN_LENGTH } from "./src/password.mjs";

let n = 0;
const ok = (name) => { n++; process.stdout.write(`  ✓ ${name}\n`); };

// Fixture range factories — stand in for the live HIBP API, fully offline.
const cleanRange = async () => "0000000000000000000000000000000000:0\n1111111111111111111111111111111111:3\n";
const throwingRange = async () => { throw new Error("HIBP unreachable"); };
/** A range that genuinely contains `suffix` with a breach count — earns the flag. */
const breachedRangeFor = (suffix, count = 42) => async () =>
  `2222222222222222222222222222222222:0\n${suffix}:${count}\n3333333333333333333333333333333333:9\n`;

// 1. sha1Prefix(): k-anonymity split — exactly 5 chars leave, 35 stay, reassemble
//    to the full uppercase digest. Real vector: SHA-1("password").
{
  const { prefix, suffix } = sha1Prefix("password");
  assert.equal(prefix.length, 5);                 // ONLY these 5 chars ever leave the box
  assert.equal(suffix.length, 35);
  assert.match(prefix + suffix, /^[0-9A-F]{40}$/); // uppercase hex, full digest
  assert.equal(prefix, "5BAA6");
  assert.equal(suffix, "1E4C9B93F3F0682250B6CF8331B7EE68FD8");
  ok("sha1Prefix() splits 5+35, uppercase hex, real vector for 'password'");
}

// 2. Short password rejected — even with a clean breach range.
{
  const r = await checkPasswordStrength("Ab1!", { fetchRange: cleanRange });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((m) => m.includes(String(MIN_LENGTH))));
  assert.equal(r.breached, false);
  ok("short password rejected on length");
}

// 3. Weak password rejected — long enough but not enough character variety.
{
  const r = await checkPasswordStrength("alllowercaseletters", { fetchRange: cleanRange });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((m) => m.toLowerCase().includes("variety")));
  ok("low-variety password rejected on complexity");
}

// 4. Strong, non-breached password accepted — clean range, no reasons.
{
  const r = await checkPasswordStrength("Str0ng!Passw0rd", { fetchRange: cleanRange });
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.breached, false);
  assert.equal(r.breachCount, 0);
  ok("strong, non-breached password accepted");
}

// 5. Known-breached password flagged — inject a range carrying its real suffix.
{
  const pw = "Str0ng!Passw0rd";
  const { suffix } = sha1Prefix(pw);
  const r = await checkPasswordStrength(pw, { fetchRange: breachedRangeFor(suffix, 1337) });
  assert.equal(r.breached, true);
  assert.equal(r.breachCount, 1337);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((m) => m.toLowerCase().includes("breach")));
  ok("breached password flagged via injected fixture suffix");
}

// 6. FAIL OPEN — breach lookup throws → strong password still accepted.
{
  const r = await checkPasswordStrength("Str0ng!Passw0rd", { fetchRange: throwingRange });
  assert.equal(r.ok, true);          // outage must not block signup
  assert.equal(r.breached, false);
  assert.deepEqual(r.reasons, []);
  ok("fail-open: HIBP outage does not block a rules-valid password");
}

// 7. FAIL OPEN does NOT mask a rules failure — a short password is still rejected
//    when the breach lookup is down.
{
  const r = await checkPasswordStrength("Ab1!", { fetchRange: throwingRange });
  assert.equal(r.ok, false);
  ok("fail-open still enforces the rules floor");
}

process.stdout.write(`\nselftest: ${n} checks passed\n`);
