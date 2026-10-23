"use client";

import Link from "next/link";
import { useAssumptions } from "@/components/assumptions";
import { RatesPanel } from "@/components/rates-panel";
import { costBreakdown, housingBudget, maxAffordablePrice, withSavings } from "@/lib/finance";
import { money } from "@/lib/format";
import type { Search } from "@/lib/listing";

/** Step 1 of the flow: what the person can afford, from income, debts and savings. A formula, not a model. */
export function AffordabilityCard({ search }: { search: Search }) {
  const { assumptions: a } = useAssumptions();
  if (search.income === undefined) return null;

  const savings = search.savings ?? 0;
  const debts = search.debts ?? 0;
  const gross = search.income / 12;
  const cap28 = 0.28 * gross;
  const cap36 = 0.36 * gross - debts;
  const budget = housingBudget(search.income, debts);
  const maxPrice = maxAffordablePrice(budget, savings, a);
  const at = costBreakdown(maxPrice || 1, null, withSavings(maxPrice || 1, a, savings));
  const diff = budget - search.rent;

  return (
    <section className="border-b border-line py-10" aria-labelledby="afford-heading">
      <p className="eyebrow">Step 1 · What you can afford</p>
      {budget > 0 ? (
        <h2 id="afford-heading" className="display mt-3 text-4xl sm:text-5xl">
          You can afford a home up to <span className="text-accent-ink">{money(maxPrice)}</span>
        </h2>
      ) : (
        <h2 id="afford-heading" className="display mt-3 text-4xl sm:text-5xl">
          Your debts leave no room for a mortgage right now
        </h2>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <dl className="divide-y divide-line rounded-xl border border-line bg-card px-5 text-sm">
          <Row label="Income before taxes" value={`${money(search.income)} a year (${money(gross)} a month)`} />
          <Row
            label="Monthly housing budget"
            value={money(budget)}
            note={`The lower of 28% of income (${money(cap28)}) or 36% minus your debts (${money(Math.max(cap36, 0))}).`}
          />
          <Row label="Down payment" value={money(savings)} note="Your savings, used as the down payment." />
          <Row
            label="Compared with your rent"
            value={`${money(search.rent)} a month`}
            note={
              diff >= 0
                ? `You could spend about ${money(diff)} a month more on a home than you pay in rent.`
                : `Your rent is about ${money(-diff)} a month above the usual limit for your income, so homes within the limit cost less than your rent.`
            }
          />
        </dl>

        {budget > 0 && (
          <div className="rounded-xl border border-line bg-card p-5 text-sm">
            <p className="font-semibold">Monthly cost of a {money(maxPrice)} home</p>
            <dl className="mt-3 space-y-1.5 text-ink-2">
              <Line label={`Loan payment (${a.ratePct}%, ${a.termYears} years)`} value={at.principalInterest} />
              <Line label={`Property tax (${a.taxRatePct}% a year)`} value={at.tax} />
              <Line label={`Home insurance (${a.insuranceRatePct}% a year)`} value={at.insurance} />
              {at.pmi > 0 && <Line label="Mortgage insurance (under 20% down)" value={at.pmi} />}
              <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold text-ink">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(at.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-3">
              Closing costs (about {a.closingCostPct}% of the price, roughly {money((maxPrice * a.closingCostPct) / 100)}) are extra, and
              are not covered by your down payment. HOA fees are not included.
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm">
        <Link
          href={`/what-if?income=${search.income}&rent=${search.rent}&savings=${savings}&debts=${debts}`}
          className="font-semibold underline underline-offset-4"
        >
          What if you saved more, earned more or got a lower rate?
        </Link>
      </p>

      <div className="mt-4">
        <RatesPanel />
      </div>
    </section>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="py-3">
      <div className="flex justify-between gap-4">
        <dt className="text-ink-2">{label}</dt>
        <dd className="font-medium tabular-nums">{value}</dd>
      </div>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="tabular-nums">{money(value)}</dd>
    </div>
  );
}
