"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_ASSUMPTIONS, type Assumptions } from "@/lib/finance";

const STORAGE_KEY = "ciooh.assumptions.v1";

type Ctx = { assumptions: Assumptions; update: (patch: Partial<Assumptions>) => void; reset: () => void };

const AssumptionsContext = createContext<Ctx | null>(null);

function sanitize(raw: unknown): Assumptions {
  const out = { ...DEFAULT_ASSUMPTIONS };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(out) as (keyof Assumptions)[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) out[key] = v;
    }
  }
  if (![15, 20, 30].includes(out.termYears)) out.termYears = DEFAULT_ASSUMPTIONS.termYears;
  return out;
}

export function AssumptionsProvider({ children }: { children: ReactNode }) {
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
      if (stored) setAssumptions(sanitize(JSON.parse(stored)));
    } catch {}
  }, []);

  const save = (next: Assumptions) => {
    setAssumptions(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <AssumptionsContext.Provider
      value={{
        assumptions,
        update: (patch) => save(sanitize({ ...assumptions, ...patch })),
        reset: () => save(DEFAULT_ASSUMPTIONS),
      }}
    >
      {children}
    </AssumptionsContext.Provider>
  );
}

export function useAssumptions() {
  const ctx = useContext(AssumptionsContext);
  if (!ctx) throw new Error("useAssumptions must be used inside AssumptionsProvider");
  return ctx;
}

const DOWN_PAYMENTS = [3.5, 5, 10, 20];

export function AssumptionControls({ compact = false }: { compact?: boolean }) {
  const { assumptions: a, update, reset } = useAssumptions();
  const [rateText, setRateText] = useState(String(a.ratePct));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the text box in sync after a reset or restore
    setRateText(String(a.ratePct));
  }, [a.ratePct]);

  const commitRate = () => {
    const n = Number(rateText);
    if (Number.isFinite(n) && n > 0 && n < 20) update({ ratePct: Math.round(n * 1000) / 1000 });
    else setRateText(String(a.ratePct));
  };

  const isDefault = JSON.stringify(a) === JSON.stringify(DEFAULT_ASSUMPTIONS);

  return (
    <fieldset className={`flex flex-wrap items-end gap-x-6 gap-y-3 ${compact ? "text-sm" : ""}`}>
      <legend className="sr-only">Loan assumptions</legend>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3" id="dp-label">
          Down payment
        </span>
        <div role="radiogroup" aria-labelledby="dp-label" className="inline-flex rounded-md border border-line bg-card p-0.5">
          {DOWN_PAYMENTS.map((pct) => {
            const active = a.downPaymentPct === pct;
            return (
              <button
                key={pct}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ downPaymentPct: pct })}
                className={`rounded px-2.5 py-1 tabular-nums transition-colors ${
                  active ? "bg-navy text-on-navy" : "text-ink-2 hover:bg-sunk"
                }`}
              >
                {pct}%
              </button>
            );
          })}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3">Interest rate</span>
        <span className="field inline-flex w-28 items-center gap-1 py-1">
          <input
            inputMode="decimal"
            value={rateText}
            onChange={(e) => setRateText(e.target.value)}
            onBlur={commitRate}
            onKeyDown={(e) => e.key === "Enter" && commitRate()}
            className="w-full bg-transparent tabular-nums outline-none"
            aria-describedby="rate-hint"
          />
          <span className="text-ink-3">%</span>
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3">Term</span>
        <select
          value={a.termYears}
          onChange={(e) => update({ termYears: Number(e.target.value) })}
          className="field py-1"
        >
          <option value={30}>30 years</option>
          <option value={20}>20 years</option>
          <option value={15}>15 years</option>
        </select>
      </label>
      {!isDefault && (
        <button type="button" onClick={reset} className="pb-1.5 text-sm text-ink-2 underline underline-offset-4">
          Reset
        </button>
      )}
      <p id="rate-hint" className="sr-only">
        Use the rate from your lender quote if you have one.
      </p>
    </fieldset>
  );
}
