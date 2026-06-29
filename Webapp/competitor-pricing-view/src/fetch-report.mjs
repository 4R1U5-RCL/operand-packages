// src/fetch-report.mjs — PURE display-side of the competitor-pricing read seam.
//
// This file shapes and formats the LATEST competitor-pricing report that the
// hosted read endpoint hands back. It does NOT produce that report. The scrape,
// the schedule, and the structuring/LLM step all run on the studio's hosted n8n
// instance (csco.app.n8n.cloud) — see CLAUDE.md and docs/boundary.md. Nothing in
// here fetches the web, runs a crawl, or calls a model.
//
// Two responsibilities, both display-only:
//   1. shapeReport(raw)  — normalise the already-produced report object into a
//      stable, render-ready shape (sorted rows, deltas vs your price, labels).
//      Pure, deterministic, total: any malformed input degrades to an empty
//      report rather than throwing.
//   2. getLatestReport(fetchFn, opts) — a THIN read: call an INJECTED fetch of
//      the read endpoint, parse its JSON, hand it to shapeReport. The fetch is
//      injected so this module owns no transport and no pipeline; it is the
//      consumer's `fetch` (browser global, server fetch, or a test stub).
//
// Node 22 built-ins only. Zero npm deps. ESM.

/* ----------------------------------------------------------------------- *
 * small pure helpers
 * ----------------------------------------------------------------------- */

const CURRENCY_SYMBOL = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", CAD: "C$" };

/** Coerce to a finite number, or null. Never throws. */
function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Money label, locale-independent so it is deterministic in tests. */
export function formatMoney(amount, currency = "USD") {
  const n = num(amount);
  if (n == null) return "—";
  const sym = CURRENCY_SYMBOL[currency];
  const body = Math.abs(n).toFixed(2);
  return sym ? `${sym}${body}` : `${currency} ${body}`;
}

/** Signed delta label, e.g. "+£0.50" / "-£0.55". */
export function formatDelta(delta, currency = "USD") {
  const n = num(delta);
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "+";
  return `${sign}${formatMoney(Math.abs(n), currency)}`;
}

/** ISO timestamp → deterministic absolute UTC label "YYYY-MM-DD HH:MM UTC". */
export function formatGeneratedAt(iso) {
  if (typeof iso !== "string" || !iso.trim()) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const p = (x) => String(x).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Sort key: cheapest first, priceless rows sink to the bottom. */
const priceSortKey = (row) => (row.price == null ? Infinity : row.price);

function emptyReport(note) {
  return {
    ok: false,
    note,
    reportId: null,
    generatedAt: null,
    generatedAtLabel: "unknown",
    currency: "USD",
    product: { title: "Untitled product", sku: null, yourPrice: null, yourPriceLabel: "—" },
    summary: {
      competitorCount: 0,
      cheapest: null,
      yourPosition: null,
      positionLabel: "n/a",
      undercutBy: null,
    },
    rows: [],
  };
}

/* ----------------------------------------------------------------------- *
 * (1) shapeReport — pure display formatter
 * ----------------------------------------------------------------------- */

/**
 * Normalise the raw report the read seam returned into a render-ready shape.
 * @param {unknown} raw  the already-produced report object (hosted output)
 * @returns {object} a stable shape; never throws, degrades to emptyReport()
 */
export function shapeReport(raw) {
  if (!raw || typeof raw !== "object") return emptyReport("no report");

  const currency = typeof raw.currency === "string" ? raw.currency : "USD";
  const product = raw.product && typeof raw.product === "object" ? raw.product : {};
  const yourPrice = num(product.your_price);
  const competitors = Array.isArray(raw.competitors) ? raw.competitors : [];

  const rows = competitors
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const price = num(c.price);
      const delta =
        yourPrice != null && price != null ? round2(price - yourPrice) : null;
      return {
        name: typeof c.name === "string" && c.name.trim() ? c.name : "Unknown",
        url: typeof c.url === "string" ? c.url : null,
        inStock: c.in_stock === true,
        price,
        priceLabel: formatMoney(price, currency),
        delta,
        deltaLabel: delta == null ? "—" : formatDelta(delta, currency),
        cheaperThanYou: delta != null && delta < 0,
      };
    })
    .sort((a, b) => priceSortKey(a) - priceSortKey(b));

  const pricedRivals = rows.filter((r) => r.price != null);
  const undercutBy =
    yourPrice == null ? null : pricedRivals.filter((r) => r.price < yourPrice).length;
  const position = undercutBy == null ? null : undercutBy + 1; // 1 = you are cheapest

  return {
    ok: true,
    note: rows.length ? "ok" : "report has no competitor rows",
    reportId: typeof raw.report_id === "string" ? raw.report_id : null,
    generatedAt: typeof raw.generated_at === "string" ? raw.generated_at : null,
    generatedAtLabel: formatGeneratedAt(raw.generated_at),
    currency,
    product: {
      title: typeof product.title === "string" && product.title.trim() ? product.title : "Untitled product",
      sku: typeof product.sku === "string" ? product.sku : null,
      yourPrice,
      yourPriceLabel: formatMoney(yourPrice, currency),
    },
    summary: {
      competitorCount: rows.length,
      cheapest: rows.find((r) => r.price != null) ?? null,
      yourPosition: position,
      positionLabel:
        position == null ? "n/a" : `${ordinal(position)} of ${pricedRivals.length + 1}`,
      undercutBy,
    },
    rows,
  };
}

/* ----------------------------------------------------------------------- *
 * (2) getLatestReport — thin read over an INJECTED fetch
 * ----------------------------------------------------------------------- */

/**
 * Pull the latest already-produced report through an injected fetch of the read
 * endpoint, then shape it. This module never constructs a transport, schedule,
 * or scraper — `fetchFn` is the caller's fetch (browser global / server fetch /
 * test stub). Fail-soft and loud: it never throws and never returns a silent OK.
 *
 * @param {(url:string)=>Promise<{ok:boolean,status?:number,json:()=>Promise<any>}>} fetchFn
 * @param {{ endpoint?: string }} [opts]
 * @returns {Promise<{ok:boolean, wired:boolean, note:string, report:object|null}>}
 */
export async function getLatestReport(fetchFn, opts = {}) {
  if (typeof fetchFn !== "function") {
    throw new TypeError("getLatestReport requires an injected fetch function");
  }
  const endpoint = opts.endpoint ?? process.env.COMPETITOR_REPORT_URL;
  if (!endpoint) {
    return {
      ok: false,
      wired: false,
      note: "NOT WIRED: COMPETITOR_REPORT_URL unset (read endpoint of the hosted report)",
      report: null,
    };
  }

  let res;
  try {
    res = await fetchFn(endpoint);
  } catch (err) {
    return { ok: false, wired: true, note: `read seam fetch failed: ${err?.message ?? err}`, report: null };
  }
  if (!res || !res.ok) {
    return { ok: false, wired: true, note: `read seam returned ${res?.status ?? "no response"}`, report: null };
  }

  let raw;
  try {
    raw = await res.json();
  } catch {
    return { ok: false, wired: true, note: "read seam returned invalid JSON", report: null };
  }

  return { ok: true, wired: true, note: "ok", report: shapeReport(raw) };
}
