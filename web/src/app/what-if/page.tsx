import type { Metadata } from "next";
import { Suspense } from "react";
import { WhatIf } from "@/components/what-if";
import { usablePrices } from "@/lib/model/ours-search";

export const metadata: Metadata = { title: "What if?" };

export default function WhatIfPage({ searchParams }: PageProps<"/what-if">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <header className="mb-10 max-w-3xl">
        <p className="eyebrow">What if?</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">What would change your answer?</h1>
        <p className="mt-5 text-lg text-ink-2">
          Move the sliders to see how saving more, earning more or a lower mortgage rate changes the most you can afford, and how many Houston
          homes that opens up.
        </p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-sunk" aria-busy="true" aria-label="Loading" />}>
        <Loaded searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Loaded({ searchParams }: { searchParams: PageProps<"/what-if">["searchParams"] }) {
  const sp = await searchParams;
  const read = (k: string, d: number, max: number) => {
    const raw = typeof sp[k] === "string" ? Number((sp[k] as string).replace(/[$,\s]/g, "")) : NaN;
    return Number.isFinite(raw) && raw >= 0 && raw <= max ? Math.round(raw) : d;
  };
  const initial = {
    income: read("income", 70_000, 2_000_000),
    rent: read("rent", 1_500, 20_000),
    savings: read("savings", 20_000, 5_000_000),
    debts: read("debts", 300, 50_000),
  };
  return <WhatIf prices={usablePrices()} initial={initial} />;
}
