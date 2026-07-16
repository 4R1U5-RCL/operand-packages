/**
 * reference/results-hook.reference.ts — the READ SEAM the client subscribes to.
 *
 * Reference only (not compiled by this package). It shows how a client repo
 * pulls the LATEST already-produced competitor-pricing report. Mirrors Tessera's
 * working-screen pattern: the run completes server-side regardless of the
 * client; the client's only job is to READ the latest result and keep the UI in
 * sync. (cf. tessera apps/web .../working/WorkingPoller.tsx + lib/n8n.ts.)
 *
 * BOUNDARY — this hook only READS. It does not trigger, schedule, or scrape.
 * The report it reads was produced entirely by the studio's hosted pricing
 * service on <studio-n8n-host>. Adding a scrape/schedule/structuring call here
 * is a reverse-gate-B boundary violation (see CLAUDE.md / docs/boundary.md).
 *
 * Two halves:
 *   A. a server route handler that proxies the hosted read endpoint so the
 *      report URL + any read token stay server-side (env, never NEXT_PUBLIC_*).
 *   B. a tiny client hook that polls that route and shapes the response with the
 *      package's pure formatter.
 */
import { useEffect, useRef, useState } from "react";
// In a real app: import { shapeReport, getLatestReport } from "@studio/competitor-pricing-view";
import { shapeReport, getLatestReport } from "../src/fetch-report.mjs";

/* --------------------------------------------------------------------- *
 * A. SERVER read seam (Next.js route handler) — proxies the hosted report.
 *
 *    The report endpoint + read token are server-only env. This handler is a
 *    READ proxy: GET the hosted latest-report endpoint, pass JSON straight
 *    through. No write, no trigger. `getLatestReport` takes the server `fetch`
 *    injected — the package owns no transport.
 *
 *    // app/api/competitor-pricing/route.ts
 *    export const runtime = "nodejs";
 *    export async function GET() {
 *      const endpoint = process.env.COMPETITOR_REPORT_URL;     // hosted read URL
 *      const token = process.env.COMPETITOR_REPORT_TOKEN;       // optional read auth
 *      const res = await getLatestReport(
 *        (url) => fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : undefined),
 *        { endpoint },
 *      );
 *      return Response.json(res, { status: res.ok ? 200 : res.wired ? 502 : 503 });
 *    }
 * --------------------------------------------------------------------- */

/* --------------------------------------------------------------------- *
 * B. CLIENT hook — subscribe to the latest report by polling the read route.
 * --------------------------------------------------------------------- */

import type { ShapedReport } from "./ReportView.reference";

export interface UseLatestReportResult {
  report: ShapedReport | null;
  loading: boolean;
  error: string | null;
  /** Force an immediate re-read (e.g. a manual refresh button). */
  refresh: () => void;
}

/**
 * Poll the in-app read route for the latest report. Default cadence is gentle
 * (5 min): the report only changes when the hosted service publishes a new run,
 * so there is nothing to gain from hammering it. Re-reads on tab focus so a
 * backgrounded phone is not stranded on a stale view.
 */
export function useLatestReport(
  { route = "/api/competitor-pricing", intervalMs = 5 * 60 * 1000 } = {},
): UseLatestReportResult {
  const [report, setReport] = useState<ShapedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tick = useRef(0);

  useEffect(() => {
    let alive = true;

    const read = async () => {
      try {
        const res = await fetch(route, { cache: "no-store" });
        if (!res.ok) throw new Error(`read route ${res.status}`);
        const payload = await res.json();
        if (!alive) return;
        // The route already shaped it; re-shape defensively in case a raw report
        // is served directly. shapeReport is total, so this never throws.
        setReport(payload.report ?? shapeReport(payload));
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "read failed");
      } finally {
        if (alive) setLoading(false);
      }
    };

    read();
    const id = setInterval(read, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", read);

    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", read);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, intervalMs, tick.current]);

  return {
    report,
    loading,
    error,
    refresh: () => {
      tick.current += 1;
    },
  };
}
