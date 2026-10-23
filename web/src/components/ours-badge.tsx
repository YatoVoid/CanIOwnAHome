import type { Ours } from "@/lib/listing";

const CHIP = "inline-flex items-center rounded border bg-card px-2 py-0.5 text-xs font-semibold";

/** Small chips for a home card: only the notable results, so most cards stay quiet. */
export function OursChips({ ours }: { ours: Ours | null | undefined }) {
  if (!ours) return null;
  const chips: { text: string; cls: string }[] = [];
  if (ours.label === "bargain") chips.push({ text: "Priced below fair value", cls: "border-good/40 text-good" });
  if (ours.label === "flood_trap") chips.push({ text: "Cheap, but flood-prone ZIP", cls: "border-over/40 text-over" });
  if (ours.floodLevel === "High" && ours.label !== "flood_trap") chips.push({ text: "High flood-claim ZIP", cls: "border-over/40 text-over" });
  if (!chips.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c.text} className={`${CHIP} ${c.cls}`}>
          {c.text}
        </span>
      ))}
    </div>
  );
}

const VERDICT: Record<Ours["label"], (gap: number) => string> = {
  bargain: (g) => `All three of our models put this home at least 10% below fair price (about ${Math.abs(g).toFixed(0)}% below).`,
  flood_trap: (g) =>
    `It is priced about ${Math.abs(g).toFixed(0)}% below fair value, but its ZIP has a high rate of flood-insurance claims. The low price may reflect flood risk, so check before getting excited.`,
  fair: (g) =>
    g >= 10
      ? `The asking price is about ${g.toFixed(0)}% below our estimate, but our three models did not all agree, so we are not calling it a bargain.`
      : "The asking price is in line with similar homes.",
  overpriced: (g) => `The asking price is about ${Math.abs(g).toFixed(0)}% above what similar homes list for.`,
};

const FLOOD_TEXT = {
  Low: "Few flood-insurance claims per listing in this ZIP compared with the rest of Houston.",
  Medium: "A middling rate of flood-insurance claims in this ZIP compared with the rest of Houston.",
  High: "One of the higher rates of flood-insurance claims in Houston, per listing.",
} as const;

export function OursCheck({ ours, price }: { ours: Ours; price: number }) {
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-card p-6">
        <p className="eyebrow">Fair price</p>
        <p className="figure mt-2 text-4xl">{money(ours.fairPrice)}</p>
        <p className="mt-1 text-sm text-ink-3">Asking {money(price)}</p>
        <p className="mt-4 text-ink-2">{VERDICT[ours.label](ours.gapPct)}</p>
      </div>
      <div className="rounded-xl border border-line bg-card p-6">
        <p className="eyebrow">Flood history of this ZIP</p>
        <p className="figure mt-2 text-4xl">{ours.floodLevel ?? "Unknown"}</p>
        <p className="mt-4 text-ink-2">{ours.floodLevel ? FLOOD_TEXT[ours.floodLevel] : "No flood data for this ZIP."}</p>
      </div>
      <p className="text-sm text-ink-3 lg:col-span-2">
        Fair price comes from a model trained on June 2024 Houston listings (size, location, home type, county assessed value), and each home is
        priced by a model that never saw it. It cannot see condition or age. The flood level counts FEMA flood-insurance claims in the ZIP
        relative to listings there: insured homes only, a screening signal and not a flood map. Check FEMA&apos;s flood map and the home&apos;s own
        history before buying.
      </p>
    </div>
  );
}
