#!/usr/bin/env node
// selftest.mjs — OFFLINE earned checks for the transactional-email seam.
//
// No network, no creds. Proves the PURE parts behave before any live wiring
// exists: recipient validation (accept + reject), payload shape (incl. the
// base64 attachment), and the fail-soft / NOT-WIRED path when the Resend key is
// unset. Exits 0 only if EVERY assertion holds — a real green, not a "ran
// without error". Run: node selftest.mjs
//
// Discipline borrowed from ~/Claude/notify/scripts/selftest.mjs and audit's
// "every pass is earned": the not-wired check is a NEGATIVE control — it proves
// the seam refuses to silently succeed without a key, exactly the failure a green
// must never paper over.

import assert from "node:assert/strict";
import { validateRecipient, EMAIL_RE } from "./src/validate.mjs";
import { buildPayload, encodeAttachment, sendEmail, RESEND_ENDPOINT } from "./src/send.mjs";

let n = 0;
const ok = (name) => { n++; process.stdout.write(`  ✓ ${name}\n`); };

// Guard the env so the not-wired check is real regardless of the host. We force
// the key absent for the duration and restore it after.
const savedKey = process.env.RESEND_REPORTING_API_KEY;
const savedFrom = process.env.EMAIL_FROM;
delete process.env.RESEND_REPORTING_API_KEY;
delete process.env.EMAIL_FROM;

try {
  // 1. validateRecipient ACCEPTS well-formed addresses (and trims).
  {
    for (const good of ["a@b.co", "first.last@sub.example.com", "  user@host.io  "]) {
      const r = validateRecipient(good);
      assert.equal(r.valid, true, `should accept ${good}`);
      assert.equal(r.error, null);
      assert.equal(r.recipient, good.trim());
    }
    assert.match("x@y.zz", EMAIL_RE); // the exported regex is the gate
    ok("validateRecipient() accepts + trims well-formed addresses");
  }

  // 2. validateRecipient REJECTS bad input — the server-side gate fires.
  {
    for (const bad of ["", "   ", "no-at-sign", "missing@domain", "two@@at.co", "spa ce@x.co", "@nolocal.co", null, undefined, 42]) {
      const r = validateRecipient(bad);
      assert.equal(r.valid, false, `should reject ${JSON.stringify(bad)}`);
      assert.equal(r.recipient, null);
      assert.ok(r.error && r.error.length > 0);
    }
    ok("validateRecipient() rejects malformed / empty / non-string input");
  }

  // 3. buildPayload is PURE and produces the exact Resend shape — no attachment.
  {
    const p = buildPayload({ from: "Tessera <reports@x.dev>", to: "u@h.co", subject: "Hi", html: "<b>x</b>" });
    assert.deepEqual(p, { from: "Tessera <reports@x.dev>", to: "u@h.co", subject: "Hi", html: "<b>x</b>" });
    assert.equal("attachments" in p, false); // omitted, not null/empty
    // deterministic: same input → identical body
    const a = JSON.stringify(buildPayload({ from: "f", to: "t@h.co", subject: "s", html: "h" }));
    const b = JSON.stringify(buildPayload({ from: "f", to: "t@h.co", subject: "s", html: "h" }));
    assert.equal(a, b);
    ok("buildPayload() pure; exact shape; omits attachments when none");
  }

  // 4. encodeAttachment + buildPayload — base64 attachment shape.
  {
    const enc = encodeAttachment({ filename: "report.csv", content: "a,b,c\n1,2,3\n" });
    assert.equal(enc.filename, "report.csv");
    assert.equal(enc.content, Buffer.from("a,b,c\n1,2,3\n", "utf-8").toString("base64"));
    assert.equal(Buffer.from(enc.content, "base64").toString("utf-8"), "a,b,c\n1,2,3\n"); // round-trips

    const p = buildPayload({ from: "f", to: "t@h.co", subject: "s", html: "h", attachment: { filename: "r.csv", content: "x" } });
    assert.ok(Array.isArray(p.attachments) && p.attachments.length === 1);
    assert.equal(p.attachments[0].filename, "r.csv");
    assert.equal(p.attachments[0].content, Buffer.from("x", "utf-8").toString("base64"));

    // Buffer input is accepted as raw bytes; invalid attachments are dropped.
    assert.equal(encodeAttachment({ filename: "b.bin", content: Buffer.from([1, 2, 3]) }).content, Buffer.from([1, 2, 3]).toString("base64"));
    assert.equal(encodeAttachment(null), null);
    assert.equal(encodeAttachment({ filename: "x" }), null);          // no content
    assert.equal(encodeAttachment({ content: "x" }), null);           // no filename
    ok("encodeAttachment() base64-encodes + round-trips; payload carries one attachment");
  }

  // 5. NEGATIVE CONTROL — no API key → fail-soft NOT-WIRED no-op. Never throws,
  //    never a silent success, and crucially never reaches fetch (we pass a
  //    fetchImpl that would throw if called).
  {
    const exploding = () => { throw new Error("fetch must NOT be called when not wired"); };
    const res = await sendEmail("user@host.co", "Subject", "<p>hi</p>", { fetchImpl: exploding });
    assert.equal(res.sent, false);
    assert.equal(res.status, 0);
    assert.match(res.note, /NOT WIRED/);
    ok("sendEmail() fail-soft + loud NOT-WIRED when RESEND_REPORTING_API_KEY unset");
  }

  // 6. A bad recipient is rejected BEFORE config/network — fetch never called.
  {
    const exploding = () => { throw new Error("fetch must NOT be called for a bad recipient"); };
    const res = await sendEmail("not-an-email", "S", "h", { apiKey: "re_fake", from: "f@x.co", fetchImpl: exploding });
    assert.equal(res.sent, false);
    assert.equal(res.status, 0);
    assert.match(res.note, /invalid/i);
    ok("sendEmail() rejects a bad recipient pre-flight (no send attempted)");
  }

  // 7. With a key + a (fake) fetch, sendEmail POSTs the right request and maps the
  //    result — proving the wiring without any real network.
  {
    let seen = null;
    const fakeFetch = async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 200 };
    };
    const res = await sendEmail("user@host.co", "Your report is ready", "<p>done</p>", {
      apiKey: "re_fake_send_only",
      from: "Tessera <reports@tessera-project.dev>",
      attachment: { filename: "report.csv", content: "a,b\n1,2\n" },
      fetchImpl: fakeFetch,
    });
    assert.equal(res.sent, true);
    assert.equal(res.status, 200);
    assert.match(res.note, /accepted/);
    assert.equal(seen.url, RESEND_ENDPOINT);
    assert.equal(seen.init.method, "POST");
    assert.equal(seen.init.headers.Authorization, "Bearer re_fake_send_only");
    const body = JSON.parse(seen.init.body);
    assert.equal(body.to, "user@host.co");
    assert.equal(body.from, "Tessera <reports@tessera-project.dev>");
    assert.equal(body.attachments[0].filename, "report.csv");
    assert.equal(body.attachments[0].content, Buffer.from("a,b\n1,2\n", "utf-8").toString("base64"));
    ok("sendEmail() POSTs to Resend with auth + payload, maps 2xx → sent");
  }

  // 8. A non-2xx from Resend is fail-soft → sent:false, status carried, no throw.
  {
    const fail = async () => ({ ok: false, status: 422 });
    const res = await sendEmail("user@host.co", "S", "h", { apiKey: "re_fake", from: "f@x.co", fetchImpl: fail });
    assert.equal(res.sent, false);
    assert.equal(res.status, 422);
    assert.match(res.note, /rejected/);
    ok("sendEmail() maps a non-2xx to a soft failure, never throws");
  }
} finally {
  if (savedKey !== undefined) process.env.RESEND_REPORTING_API_KEY = savedKey;
  if (savedFrom !== undefined) process.env.EMAIL_FROM = savedFrom;
}

process.stdout.write(`\nselftest: ${n} checks passed\n`);
