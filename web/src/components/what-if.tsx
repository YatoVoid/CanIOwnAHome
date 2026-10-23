"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OURS, Stat, TableView } from "@/components/charts";
import { RatesPanel } from "@/components/rates-panel";
import { costBreakdown, DEFAULT_ASSUMPTIONS, housingBudget, maxAffordablePrice, withSavings } from "@/lib/finance";
import { compactMoney, money, signedMoney } from "@/lib/format";

type Initial = { income: number; rent: number; savings: number; debts: number };

const num = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function outcome(prices: number[], income: number, savings: number, debts: number, ratePct: number) {
  const a = { ...DEFAULT_ASSUMPTIONS, ratePct };
  const budget = housingBudget(income, debts);
  const maxPrice = maxAffordablePrice(budget, savings, a);
  let homes = 0;
  for (const p of prices) if (costBreakdown(p, null, withSavings(p, a, savings)).total <= budget) homes++;
  return { budget, maxPrice, homes };
}

export function WhatIf({ prices, initial }: { prices: number[]; initial: Initial }) {
  const [income, setIncome] = useState(String(initial.income));
  const [rent, setRent] = useState(String(initial.rent));
  const [savings, setSavings] = useState(String(initial.savings));
  const [debts, setDebts] = useState(String(initial.debts));
  const [rate, setRate] = useState(String(DEFAULT_ASSUMPTIONS.ratePct));
  const [moreSavings, setMoreSavings] = useState(10_000);
  const [moreIncome, setMoreIncome] = useState(0);
  const [rateDrop, setRateDrop] = useState(0);

  const i = num(income);
  const s = num(savings);
  const d = num(debts);
  const r = Math.min(Math.max(num(rate), 0.5), 20);

  const today = useMemo(() => outcome(prices, i, s, d, r), [prices, i, s, d, r]);
  const whatIf = useMemo(
    () => outcome(prices, i + moreIncome, s + moreSavings, d, Math.max(r - rateDrop, 0.5)),
    [prices, i, s, d, r, moreIncome, moreSavings, rateDrop],
  );

  // How the top price grows as savings grow (income, debts and rate held at today's values).
  const curve = useMemo(() => {
    const a = { ...DEFAULT_ASSUMPTIONS, ratePct: r };
    const budget = housingBudget(i, d);
    return Array.from({ length: 21 }, (_, k) => ({ extra: k * 5_000, price: maxAffordablePrice(budget, s + k * 5_000, a) }));
  }, [i, s, d, r]);
  const per10k = curve[2].price - curve[0].price;

  const q = (inc: number, sav: number) => `/homes?income=${inc}&rent=${num(rent) || 1500}&savings=${sav}${d ? `&debts=${d}` : ""}`;
  const changed = moreSavings > 0 || moreIncome > 0 || rateDrop > 0;

  return (
    <div className="space-y-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-6">
          <fieldset className="space-y-3 rounded-xl border border-line bg-card p-5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-3">You today</legend>
            {(
              [
                ["Yearly income before taxes", income, setIncome],
                ["Monthly rent", rent, setRent],
                ["Savings (the down payment)", savings, setSavings],
                ["Monthly debts", debts, setDebts],
              ] as const
            ).map(([label, value, set]) => (
              <label key={label} className="block text-sm">
                <span className="mb-1 block text-ink-2">{label}</span>
                <span className="field flex items-center gap-1 py-1.5">
                  <span aria-hidden>$</span>
                  <input value={value} onChange={(e) => set(e.target.value)} inputMode="numeric" className="w-full bg-transparent tabular-nums outline-none" />
                </span>
              </label>
            ))}
            <label className="block text-sm">
              <span className="mb-1 block text-ink-2">Mortgage rate</span>
              <span className="field flex items-center gap-1 py-1.5">
                <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="w-full bg-transparent tabular-nums outline-none" />
                <span aria-hidden>%</span>
              </span>
            </label>
          </fieldset>

          <fieldset className="space-y-5 rounded-xl border border-line bg-card p-5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-3">What if you...</legend>
            <Slider label="Saved more" value={moreSavings} min={0} max={100_000} step={5_000} onChange={setMoreSavings} show={`+${money(moreSavings)}`} />
            <Slider label="Earned more" value={moreIncome} min={0} max={60_000} step={2_500} onChange={setMoreIncome} show={`+${money(moreIncome)} a year`} />
            <Slider label="Got a lower rate" value={rateDrop} min={0} max={2} step={0.25} onChange={setRateDrop} show={`−${rateDrop.toFixed(2)} points`} />
          </fieldset>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-line bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Today</p>
              <Stat label="Top price you can afford" value={money(today.maxPrice)} sub={`${money(today.budget)} a month for housing`} />
              <p className="text-sm text-ink-2">
                <strong className="text-ink">{today.homes.toLocaleString("en-US")}</strong> of {prices.length.toLocaleString("en-US")} listed homes are in reach.
              </p>
              <Link href={q(i, s)} className="inline-block text-sm underline underline-offset-4">
                See these homes
              </Link>
            </div>
            <div className="space-y-3 rounded-xl border border-accent/60 bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">What if</p>
              <Stat label="Top price you can afford" value={money(whatIf.maxPrice)} sub={`${money(whatIf.budget)} a month for housing`} />
              <p className="text-sm text-ink-2">
                <strong className="text-ink">{whatIf.homes.toLocaleString("en-US")}</strong> homes in reach
                {changed && (
                  <>
                    {" "}
                    (<strong className="text-ink">{whatIf.homes - today.homes >= 0 ? "+" : "−"}{Math.abs(whatIf.homes - today.homes).toLocaleString("en-US")}</strong>, top price{" "}
                    <strong className="text-ink">{signedMoney(whatIf.maxPrice - today.maxPrice)}</strong>)
                  </>
                )}
                .
              </p>
              <Link href={q(i + moreIncome, s + moreSavings)} className="inline-block text-sm underline underline-offset-4">
                See these homes
              </Link>
            </div>
          </div>

          <figure className="rounded-xl border border-line bg-card p-5">
            <figcaption className="font-semibold">How much does saving more help?</figcaption>
            <p className="mt-1 text-sm text-ink-2">
              Each extra $10,000 you save lifts your top price by about <strong className="text-ink">{money(per10k)}</strong> (at today&apos;s income and rate).
              The curve bends where your down payment reaches 20% of the price and mortgage insurance drops off.
            </p>
            <SavingsChart curve={curve} marker={moreSavings} />
            <TableView
              caption="Top affordable price by extra savings"
              head={["Extra savings", "Top price"]}
              rows={curve.filter((_, k) => k % 2 === 0).map((c) => [`+${money(c.extra)}`, money(c.price)])}
            />
          </figure>
        </div>
      </div>

      <p className="max-w-3xl text-sm text-ink-3">
        This is our affordability formula only: housing at most 28% of income, or 36% with your debts, with your savings as the down payment and
        mortgage insurance under 20% down. Closing costs and HOA fees are not included. It is not a loan offer.
      </p>
      <RatesPanel />
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, show }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; show: string }) {
  const id = `s-${label.replace(/\s/g, "-")}`;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="text-ink-2">
          {label}
        </label>
        <output htmlFor={id} className="font-medium tabular-nums">
          {show}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[var(--navy,#1c2a42)]" />
    </div>
  );
}

function SavingsChart({ curve, marker }: { curve: { extra: number; price: number }[]; marker: number }) {
  const W = 560;
  const H = 230;
  const m = { l: 62, r: 32, t: 14, b: 38 };
  const lo = Math.min(...curve.map((c) => c.price));
  const hi = Math.max(...curve.map((c) => c.price));
  const pad = (hi - lo || 1) * 0.1;
  const x = (v: number) => m.l + (v / 100_000) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - m.t - m.b);
  const at = curve.find((c) => c.extra === marker) ?? curve[0];
  const yTicks = [lo, (lo + hi) / 2, hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Top affordable price as extra savings grow" className="mt-3 w-full">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">
            {compactMoney(t)}
          </text>
        </g>
      ))}
      {[0, 25_000, 50_000, 75_000, 100_000].map((t) => (
        <text key={t} x={x(t)} y={H - m.b + 16} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
          {t === 0 ? "+$0" : `+${compactMoney(t)}`}
        </text>
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
        Extra savings
      </text>
      <polyline fill="none" stroke={OURS} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={curve.map((c) => `${x(c.extra)},${y(c.price)}`).join(" ")} />
      <circle cx={x(at.extra)} cy={y(at.price)} r={6} fill={OURS} stroke="var(--card)" strokeWidth={2} />
      <text x={Math.min(x(at.extra) + 10, W - 90)} y={y(at.price) - 12} fontSize={12} fill="var(--ink)" fontWeight={600}>
        {compactMoney(at.price)}
      </text>
    </svg>
  );
}
