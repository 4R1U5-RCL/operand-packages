/**
 * reference/ReportView.reference.tsx — READ-ONLY display of the latest report.
 *
 * Reference React/Next component (not compiled by this package; it is the shape
 * a client repo copies in and skins with its brand tokens). It RENDERS a report
 * that has already been shaped by `src/fetch-report.mjs#shapeReport`. It does no
 * fetching and owns no pipeline — data arrives as a prop.
 *
 * BOUNDARY: this component, plus `results-hook.reference.ts`, is the entire
 * client-side surface of the competitor-pricing feature. The scrape, schedule
 * and structuring all run hosted (see CLAUDE.md / docs/boundary.md). Adding any
 * of those here is a reverse-gate-B boundary violation, not a build.
 *
 * Styling is intentionally token-driven (CSS custom properties / Tailwind class
 * hooks) so brand.config.ts drives the look without editing this file.
 */
import * as React from "react";

/* The shape returned by shapeReport(). Kept inline so this reference file is
 * self-contained; in a real app import the type from the package. */
export interface CompetitorRow {
  name: string;
  url: string | null;
  inStock: boolean;
  price: number | null;
  priceLabel: string;
  delta: number | null;
  deltaLabel: string;
  cheaperThanYou: boolean;
}

export interface ShapedReport {
  ok: boolean;
  note: string;
  reportId: string | null;
  generatedAt: string | null;
  generatedAtLabel: string;
  currency: string;
  product: {
    title: string;
    sku: string | null;
    yourPrice: number | null;
    yourPriceLabel: string;
  };
  summary: {
    competitorCount: number;
    cheapest: CompetitorRow | null;
    yourPosition: number | null;
    positionLabel: string;
    undercutBy: number | null;
  };
  rows: CompetitorRow[];
}

/** How old (ms) before we show a "stale" hint. Display-only; the freshness
 *  contract is enforced hosted-side, this is just a courtesy banner. */
const STALE_AFTER_MS = 36 * 60 * 60 * 1000; // 36h

export function ReportView({ report }: { report: ShapedReport | null }) {
  if (!report || report.rows.length === 0) {
    return (
      <section className="cpv-empty" aria-live="polite">
        <p>No competitor-pricing report yet. The latest run will appear here once it is published.</p>
      </section>
    );
  }

  const stale =
    report.generatedAt != null &&
    Date.now() - new Date(report.generatedAt).getTime() > STALE_AFTER_MS;

  return (
    <section className="cpv-report" aria-label="Competitor pricing report">
      <header className="cpv-header">
        <h2 className="cpv-title">{report.product.title}</h2>
        {report.product.sku ? <p className="cpv-sku">SKU {report.product.sku}</p> : null}
        <dl className="cpv-meta">
          <div>
            <dt>Your price</dt>
            <dd>{report.product.yourPriceLabel}</dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>{report.summary.positionLabel}</dd>
          </div>
          <div>
            <dt>Competitors</dt>
            <dd>{report.summary.competitorCount}</dd>
          </div>
          <div>
            <dt>Report generated</dt>
            <dd>
              {report.generatedAtLabel}
              {stale ? <span className="cpv-stale" role="status"> · may be stale</span> : null}
            </dd>
          </div>
        </dl>
      </header>

      <table className="cpv-table">
        <caption className="cpv-caption">
          Latest competitor prices vs your {report.product.yourPriceLabel}
        </caption>
        <thead>
          <tr>
            <th scope="col">Competitor</th>
            <th scope="col">Price</th>
            <th scope="col">vs you</th>
            <th scope="col">Stock</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row, i) => (
            <tr
              key={`${row.name}-${i}`}
              className={row.cheaperThanYou ? "cpv-row cpv-row--undercut" : "cpv-row"}
            >
              <th scope="row">
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer noopener">
                    {row.name}
                  </a>
                ) : (
                  row.name
                )}
              </th>
              <td>{row.priceLabel}</td>
              <td
                className={
                  row.delta == null
                    ? "cpv-delta"
                    : row.delta < 0
                      ? "cpv-delta cpv-delta--higher" // they are cheaper → bad for you
                      : "cpv-delta cpv-delta--lower"
                }
              >
                {row.deltaLabel}
              </td>
              <td>{row.inStock ? "In stock" : "Out of stock"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="cpv-footer">
        <p className="cpv-source">
          Prices collected by the studio&rsquo;s hosted pricing service. This view is read-only.
        </p>
      </footer>
    </section>
  );
}

export default ReportView;
