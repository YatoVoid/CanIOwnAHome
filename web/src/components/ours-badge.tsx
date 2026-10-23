import { ExternalLink } from "lucide-react";
import { floodPercentile } from "@/lib/flood";
import type { Ours } from "@/lib/listing";

const CHIP = "inline-flex items-center rounded border bg-card px-2 py-0.5 text-xs font-semibold";

const FLOOD_STYLE = {
  Low: "bg-good-bg text-good",
  Medium: "bg-near-bg text-near",
  High: "bg-over-bg text-over",
} as const;

/** Shown on every home card: the flood level of the zip, in words and color, plus what it means. */
export function FloodBadge({ ours }: { ours: Ours | null | undefined }) {
  if (!ours?.floodLevel) return null;
  const pct = floodPercentile(ours.floodScore);
  return (
    <div className="mt-1.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${FLOOD_STYLE[ours.floodLevel]}`}>
        <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
        Flood risk: {ours.floodLevel}
      </span>
      {pct != null && (
        <span className="ml-2 text-xs text-ink-3">
          zip-level · more flood claims than {pct}% of Houston zips
        </span>
      )}
    </div>
  );
}

/** Deal-label chips for a home card (the flood level has its own badge). */
export function OursChips({ ours }: { ours: Ours | null | undefined }) {
  if (!ours) return null;
  const chips: { text: string; cls: string }[] = [];
  if (ours.label === "bargain") chips.push({ text: "Priced below fair value", cls: "border-good/40 text-good" });
  if (ours.label === "flood_trap") chips.push({ text: "Cheap, but flood-prone zip: possible flood trap", cls: "border-over/40 text-over" });
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
    `It is priced about ${Math.abs(g).toFixed(0)}% below fair value, but its zip has a high rate of flood-insurance claims. The low price may reflect flood risk, so check before getting excited.`,
  fair: (g) =>
    g >= 10
      ? `The asking price is about ${g.toFixed(0)}% below our estimate, but our three models did not all agree, so we are not calling it a bargain.`
      : "The asking price is in line with similar homes.",
  overpriced: (g) => `The asking price is about ${Math.abs(g).toFixed(0)}% above what similar homes list for.`,
};

const FLOOD_TEXT = {
  Low: "Few flood-insurance claims per listing in this zip compared with the rest of Houston.",
  Medium: "A middling rate of flood-insurance claims in this zip compared with the rest of Houston.",
  High: "One of the higher rates of flood-insurance claims in Houston, per listing. Be careful: ask about flood history, and price flood insurance before you buy.",
} as const;

export function OursCheck({ ours, price }: { ours: Ours; price: number }) {
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const pct = floodPercentile(ours.floodScore);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-card p-6">
        <p className="eyebrow">Fair price</p>
        <p className="figure mt-2 text-4xl">{money(ours.fairPrice)}</p>
        <p className="mt-1 text-sm text-ink-3">Asking {money(price)}</p>
        <p className="mt-4 text-ink-2">{VERDICT[ours.label](ours.gapPct)}</p>
      </div>
      <div className="rounded-xl border border-line bg-card p-6">
        <p className="eyebrow">Flood history of this zip</p>
        {ours.floodLevel ? (
          <>
            <p className={`mt-2 inline-flex items-center gap-2 rounded-full px-4 py-1 text-2xl font-semibold ${FLOOD_STYLE[ours.floodLevel]}`}>
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-current" />
              {ours.floodLevel} flood risk
            </p>
            {pct != null && <p className="mt-2 text-sm text-ink-3">More flood-insurance claims per listing than {pct}% of Houston zips.</p>}
            <p className="mt-3 text-ink-2">{FLOOD_TEXT[ours.floodLevel]}</p>
          </>
        ) : (
          <p className="mt-2 text-ink-2">No flood data for this zip.</p>
        )}
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href="https://msc.fema.gov/portal/home" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
            Check this address on FEMA&apos;s flood map <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <a href="https://www.floodsmart.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
            Flood insurance basics <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>
      </div>
      <p className="text-sm text-ink-3 lg:col-span-2">
        Fair price comes from a model trained on June 2024 Houston listings (size, location, home type, county assessed value), and each home is
        priced by a model that never saw it. It cannot see condition or age. The flood level counts FEMA flood-insurance claims in the zip
        relative to listings there: insured homes only, a screening signal for the whole zip and not a flood map for this house. Check FEMA&apos;s
        map and the home&apos;s own flood history before buying.
      </p>
    </div>
  );
}
