#!/usr/bin/env node
// selftest.mjs — OFFLINE earned checks for the competitor-pricing read seam.
//
// Two things are proven here, and the pass is EARNED (not "ran without error"):
//
//   1. The display formatter (shapeReport + the label helpers) produces the
//      right render-ready shape on a fixture report — sorting, deltas vs your
//      price, position, null-tolerance, and the fail-soft getLatestReport paths.
//
//   2. The BOUNDARY self-guard: a scanner asserts NO scraping / Firecrawl /
//      schedule / structuring-pipeline code lives in the package's own
//      src/ + reference/ source. It is watched to FAIL on a planted violation
//      (negative control) — a guard that cannot catch a bad input is not a guard.
//      This is the reverse-gate-B line drawn in code (see CLAUDE.md).
//
// Node 22 built-ins only. Zero npm deps. Run: node selftest.mjs

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  shapeReport,
  getLatestReport,
  formatMoney,
  formatDelta,
  formatGeneratedAt,
} from "./src/fetch-report.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
let n = 0;
const ok = (name) => { n++; process.stdout.write(`  ✓ ${name}\n`); };

/* ===================================================================== *
 * PART 1 — the display formatter on a fixture report
 * ===================================================================== */

const fixture = JSON.parse(
  readFileSync(join(HERE, "fixtures", "latest-report.sample.json"), "utf8"),
);

// 1. label helpers are deterministic and currency-aware.
{
  assert.equal(formatMoney(12.5, "GBP"), "£12.50");
  assert.equal(formatMoney(12.5, "USD"), "$12.50");
  assert.equal(formatMoney(7, "ZZZ"), "ZZZ 7.00");   // unknown currency → code prefix
  assert.equal(formatMoney(null), "—");
  assert.equal(formatDelta(-0.55, "GBP"), "-£0.55");
  assert.equal(formatDelta(0.5, "GBP"), "+£0.50");
  assert.equal(formatGeneratedAt("2026-06-28T06:00:00.000Z"), "2026-06-28 06:00 UTC");
  assert.equal(formatGeneratedAt("not-a-date"), "unknown");
  ok("label helpers: money/delta/timestamp deterministic + null-tolerant");
}

// 2. shapeReport() on the fixture: sorted cheapest-first, priceless last.
{
  const r = shapeReport(fixture);
  assert.equal(r.ok, true);
  assert.equal(r.currency, "GBP");
  assert.equal(r.product.yourPriceLabel, "£12.50");
  assert.equal(r.summary.competitorCount, 4);

  const order = r.rows.map((x) => x.name);
  assert.deepEqual(order, ["RoastCo", "Highland Beans", "BeanRivals", "CafeDirect Clone"]);
  // priceless row sinks to the bottom and is labelled, not crashed.
  assert.equal(r.rows[3].price, null);
  assert.equal(r.rows[3].priceLabel, "—");
  assert.equal(r.rows[3].deltaLabel, "—");
  ok("shapeReport() sorts cheapest-first, priceless rows sink + degrade cleanly");
}

// 3. deltas + undercut flags computed against your price.
{
  const r = shapeReport(fixture);
  const roastco = r.rows.find((x) => x.name === "RoastCo");
  assert.equal(roastco.delta, -0.55);          // 11.95 - 12.50
  assert.equal(roastco.deltaLabel, "-£0.55");
  assert.equal(roastco.cheaperThanYou, true);  // a rival undercutting you
  const beanrivals = r.rows.find((x) => x.name === "BeanRivals");
  assert.equal(beanrivals.delta, 0.5);         // 13.00 - 12.50
  assert.equal(beanrivals.cheaperThanYou, false);
  ok("shapeReport() computes delta vs your price + undercut flag");
}

// 4. summary: your position among priced rivals (1 = cheapest).
{
  const r = shapeReport(fixture);
  // 3 priced rivals: 11.95, 12.50, 13.00. One (11.95) undercuts your 12.50.
  assert.equal(r.summary.undercutBy, 1);
  assert.equal(r.summary.yourPosition, 2);          // 1 rival cheaper → you are 2nd
  assert.equal(r.summary.positionLabel, "2nd of 4"); // 3 priced rivals + you
  assert.equal(r.summary.cheapest.name, "RoastCo");
  ok("shapeReport() ranks your position among priced competitors");
}

// 5. shapeReport() is TOTAL — junk input degrades to an empty report.
{
  for (const bad of [null, undefined, 42, "nope", {}, { competitors: "x" }]) {
    const r = shapeReport(bad);
    assert.equal(Array.isArray(r.rows), true);
    assert.equal(r.rows.length, 0);
    assert.equal(typeof r.note, "string");
  }
  ok("shapeReport() total: malformed input → empty report, never throws");
}

// 6. getLatestReport(): injected fetch, fail-soft + loud when not wired.
{
  // not wired (no endpoint) → loud, no fetch attempted
  const notWired = await getLatestReport(() => { throw new Error("must not be called"); }, {});
  assert.equal(notWired.ok, false);
  assert.equal(notWired.wired, false);
  assert.match(notWired.note, /NOT WIRED/);
  assert.equal(notWired.report, null);

  // happy path through an injected stub fetch (no network)
  const stub = async () => ({ ok: true, status: 200, json: async () => fixture });
  const good = await getLatestReport(stub, { endpoint: "https://read.example/latest" });
  assert.equal(good.ok, true);
  assert.equal(good.wired, true);
  assert.equal(good.report.summary.cheapest.name, "RoastCo");

  // upstream non-200 → unknown-ish failure, never a silent pass
  const dead = await getLatestReport(async () => ({ ok: false, status: 503 }), {
    endpoint: "https://read.example/latest",
  });
  assert.equal(dead.ok, false);
  assert.equal(dead.report, null);
  assert.match(dead.note, /503/);

  // bad JSON → reported, not thrown
  const badJson = await getLatestReport(
    async () => ({ ok: true, status: 200, json: async () => { throw new Error("x"); } }),
    { endpoint: "https://read.example/latest" },
  );
  assert.equal(badJson.ok, false);
  assert.match(badJson.note, /invalid JSON/);

  // a non-function fetch is a programming error → throws
  await assert.rejects(() => getLatestReport(undefined, { endpoint: "x" }), /injected fetch/);
  ok("getLatestReport() injected-fetch only; fail-soft + loud on every bad path");
}

/* ===================================================================== *
 * PART 2 — the boundary self-guard (reverse-gate-B, in code)
 * ===================================================================== */

// Markers of the HOSTED recurring IP that must never appear in THIS package's
// own source. The scrape pipeline, the schedule, and the structuring/LLM step
// all run on <studio-n8n-host> — never in the client repo.
const FORBIDDEN = [
  /\bfirecrawl\b/i,
  /\bopenrouter\b/i,
  /\bscrap(e|er|ing)\b/i,
  /\bcrawl(er|ing)?\b/i,
  /\bpuppeteer\b/i,
  /\bplaywright\b/i,
  /\bnode-cron\b/i,
  /\bcron\b/i,
];

// Only the SHIPPED code surface is scanned: src/ + reference/. selftest.mjs,
// README.md, CLAUDE.md and docs/ legitimately *name* the forbidden tools in
// order to prohibit them, so they are out of the scanned set by design.
const SCAN_DIRS = ["src", "reference"];
const SCAN_EXT = /\.(mjs|js|ts|tsx)$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (SCAN_EXT.test(entry)) out.push(p);
  }
  return out;
}

/** Return [{file, line, marker}] for every forbidden marker found under `roots`. */
// Strip comments so the guard scans CODE, not prose. A file may legitimately SAY
// "this does not scrape" in a comment to enforce the boundary; only actual
// scrape/crawl/schedule CODE is a violation. (URLs like http:// are preserved.)
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function scanForbidden(roots) {
  const hits = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const lines = stripComments(readFileSync(file, "utf8")).split("\n");
      lines.forEach((text, i) => {
        for (const rx of FORBIDDEN) {
          if (rx.test(text)) hits.push({ file, line: i + 1, marker: rx.source });
        }
      });
    }
  }
  return hits;
}

// 7. NEGATIVE CONTROL — the guard must FIRE on a planted violation, or it is
//    not a guard. Plant a file that imitates a scraper, scan it, assert caught.
{
  const sandbox = mkdtempSync(join(tmpdir(), "cpv-boundary-"));
  try {
    const planted = join(sandbox, "src");
    writeFileSync(join(sandbox, "x.ts"), "x"); // ensure dir machinery is exercised
    const { mkdirSync } = await import("node:fs");
    mkdirSync(planted, { recursive: true });
    writeFileSync(
      join(planted, "evil.mjs"),
      "// boundary violation planted by the selftest\n" +
        "import { firecrawl } from 'firecrawl';\n" +
        "export async function scrape() { return firecrawl('https://rival'); }\n",
    );
    const caught = scanForbidden([planted]);
    assert.ok(caught.length >= 1, "negative control did not fire — guard is blind");
    assert.match(caught.map((h) => h.marker).join(" "), /firecrawl|scrap/i);
    ok("boundary guard negative control fires on a planted scraper");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

// 8. THE REAL ASSERTION — the package's own src/ + reference/ are clean.
{
  const hits = scanForbidden(SCAN_DIRS.map((d) => join(HERE, d)));
  if (hits.length) {
    for (const h of hits) process.stderr.write(`  BOUNDARY VIOLATION ${h.file}:${h.line} (${h.marker})\n`);
  }
  assert.equal(hits.length, 0, "scrape/schedule/structuring code found in this package — reverse-gate-B");
  ok("no scraper / Firecrawl / schedule / structuring code in src/ or reference/");
}

process.stdout.write(`\nselftest: ${n} checks passed\n`);
