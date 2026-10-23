"use client";

import { useState } from "react";
import { AssumptionControls, useAssumptions } from "@/components/assumptions";
import { FitBadge } from "@/components/fit-badge";
import { costBreakdown, equityAfterYears, withSavings } from "@/lib/finance";
import { money } from "@/lib/format";

type Part = { key: string; label: string; value: number; color: string; note: string };

export function CostBreakdown({
  price,
  hoaMonthly,
  rent,
  rentLabel = "Your budget",
  savings,
}: {
  price: number;
  hoaMonthly: number | null;
  rent: number;
  rentLabel?: string;
  /** When known, savings are the down payment. */
  savings?: number;
}) {
  const { assumptions } = useAssumptions();
  const a = savings !== undefined ? withSavings(price, assumptions, savings) : assumptions;
  const c = costBreakdown(price, hoaMonthly, a);
  const [active, setActive] = useState<string | null>(null);

  const parts: Part[] = [
    {
      key: "pi",
      label: "Principal & interest",
      value: c.principalInterest,
      color: "var(--series-1)",
      note: `${money(c.loan)} loan at ${a.ratePct}% over ${a.termYears} years`,
    },
    {
      key: "tax",
      label: "Property tax",
      value: c.tax,
      color: "var(--series-2)",
      note: `${a.taxRatePct}% of price per year`,
    },
    {
      key: "ins",
      label: "Home insurance",
      value: c.insurance,
      color: "var(--series-3)",
      note: `${a.insuranceRatePct}% of price per year`,
    },
    {
      key: "pmi",
      label: "Mortgage insurance",
      value: c.pmi,
      color: "var(--series-4)",
      note: c.pmi > 0 ? "Required under 20% down" : "None at 20% down",
    },
    {
      key: "hoa",
      label: "HOA",
      value: c.hoa,
      color: "var(--series-5)",
      note: hoaMonthly == null ? "Not listed, check with the seller" : "From the listing",
    },
  ];
  const visible = parts.filter((p) => p.value > 0);
  const scale = Math.max(c.total, rent) * 1.04;
  const activePart = parts.find((p) => p.key === active);

  const years = 5;
  const equity = equityAfterYears(price, a, years);
  const rentPaid = rent * 12 * years;

  return (
    <div className="space-y-10">
      <AssumptionControls savings={savings} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <figure className="rounded-xl border border-line bg-card p-5 sm:p-6">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">Owning vs. {rentLabel.toLowerCase()}, per month</span>
            <FitBadge monthly={c.total} rent={rent} />
          </figcaption>

          <div className="mt-6 space-y-4" onMouseLeave={() => setActive(null)}>
            <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
              <span className="text-sm text-ink-2">Own</span>
              <div className="flex items-center gap-3">
                <div className="flex h-6 gap-[2px]" style={{ width: `${(c.total / scale) * 100}%` }}>
                  {visible.map((p, i) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-label={`${p.label}: ${money(p.value)} a month`}
                      onMouseEnter={() => setActive(p.key)}
                      onFocus={() => setActive(p.key)}
                      onBlur={() => setActive(null)}
                      className="h-full transition-opacity"
                      style={{
                        flexGrow: p.value,
                        flexBasis: 0,
                        minWidth: 3,
                        background: p.color,
                        opacity: active && active !== p.key ? 0.35 : 1,
                        borderRadius: i === visible.length - 1 ? "0 4px 4px 0" : 0,
                      }}
                    />
                  ))}
                </div>
                <span className="figure shrink-0 text-lg">{money(c.total)}</span>
              </div>
            </div>
            <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
              <span className="text-sm text-ink-2">{rentLabel}</span>
              <div className="flex items-center gap-3">
                <div
                  className="h-6 rounded-r bg-ink-3/50"
                  style={{ width: `${(rent / scale) * 100}%`, minWidth: 3 }}
                />
                <span className="figure shrink-0 text-lg">{money(rent)}</span>
              </div>
            </div>
          </div>

          <p className="mt-4 min-h-[1.5rem] text-sm text-ink-2" aria-live="polite">
            {activePart
              ? `${activePart.label}: ${money(activePart.value)} a month (${Math.round((activePart.value / c.total) * 100)}% of the total)`
              : "Hover or tab through the bar to see each part."}
          </p>

          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Monthly cost breakdown</caption>
            <tbody>
              {parts.map((p) => (
                <tr
                  key={p.key}
                  className={`border-t border-line ${active === p.key ? "bg-sunk" : ""}`}
                  onMouseEnter={() => setActive(p.key)}
                >
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
                      <span>
                        {p.label}
                        <span className="block text-xs text-ink-3">{p.note}</span>
                      </span>
                    </span>
                  </th>
                  <td className="py-2 text-right tabular-nums">{money(p.value)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-ink/70 font-semibold">
                <th scope="row" className="py-2 text-left">
                  Estimated total
                </th>
                <td className="py-2 text-right tabular-nums">{money(c.total)}</td>
              </tr>
            </tbody>
          </table>
        </figure>

        <div className="grid content-start gap-4">
          <div className="rounded-xl bg-navy p-5 text-on-navy sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Cash to buy it</p>
            <p className="figure mt-2 text-4xl text-accent">{money(c.cashToClose)}</p>
            <dl className="mt-3 space-y-1 text-sm opacity-90">
              <div className="flex justify-between gap-4">
                <dt>Down payment ({Math.round(a.downPaymentPct * 10) / 10}%)</dt>
                <dd className="tabular-nums">{money(c.downPayment)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Closing costs (~{a.closingCostPct}%)</dt>
                <dd className="tabular-nums">{money(c.closingCosts)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs opacity-75">
              Texas and Houston run down payment assistance programs that can cover part of this. Ask your lender.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-card p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">After {years} years</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="figure text-3xl">{money(equity)}</p>
                <p className="text-sm text-ink-2">equity if you own</p>
              </div>
              <div>
                <p className="figure text-3xl">{money(rentPaid)}</p>
                <p className="text-sm text-ink-2">spent over {years} years at {rentLabel.toLowerCase()}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Equity counts your down payment and principal paid down, with no price growth. Repairs and selling costs
              are not included.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
