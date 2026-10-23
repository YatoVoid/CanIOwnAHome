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

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Where the asking price sits against our range, and against Zillow's Zestimate. */
function PriceRange({ ours, price, zestimate }: { ours: Ours; price: number; zestimate?: number | null }) {
  const low = ours.low ?? ours.fairPrice;
  const high = ours.high ?? ours.fairPrice;
  const values = [low, high, price, ours.fairPrice, ...(zestimate ? [zestimate] : [])];
  const min = Math.min(...values) * 0.94;
  const max = Math.max(...values) * 1.06;
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="mt-5" role="img" aria-label={`Our fair price range ${fmt(low)} to ${fmt(high)}, asking ${fmt(price)}${zestimate ? `, Zillow Zestimate ${fmt(zestimate)}` : ""}`}>
      <div className="relative h-8">
        <div className="absolute top-3 h-2 w-full rounded bg-sunk" />
        <div className="absolute top-3 h-2 rounded" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})`, minWidth: 6, background: "var(--series-1)", opacity: 0.45 }} />
        <span className="absolute top-1 h-6 w-0.5 bg-ink" style={{ left: pos(ours.fairPrice) }} />
        <span className="absolute top-0.5 size-3 -translate-x-1/2 rounded-full border-2 border-card" style={{ left: pos(price), background: "var(--accent)" }} />
        {zestimate ? <span className="absolute top-0.5 size-3 -translate-x-1/2 rotate-45 border-2 border-card" style={{ left: pos(zestimate), background: "var(--series-2)" }} /> : null}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-4 rounded-sm" style={{ background: "var(--series-1)", opacity: 0.45 }} />Our range {fmt(low)} to {fmt(high)}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-0.5 bg-ink" />Our fair price {fmt(ours.fairPrice)}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: "var(--accent)" }} />Asking {fmt(price)}</li>
        {zestimate ? <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block size-2 rotate-45" style={{ background: "var(--series-2)" }} />Zillow Zestimate {fmt(zestimate)}</li> : null}
      </ul>
    </div>
  );
}

export function OursCheck({ ours, price, zestimate }: { ours: Ours; price: number; zestimate?: number | null }) {
  const money = fmt;
  const pct = floodPercentile(ours.floodScore);
  const zGap = zestimate ? ((zestimate - ours.fairPrice) / ours.fairPrice) * 100 : null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-card p-6">
        <p className="eyebrow">Fair price</p>
        <p className="figure mt-2 text-4xl">{money(ours.fairPrice)}</p>
        <p className="mt-1 text-sm text-ink-3">Asking {money(price)}</p>
        <p className="mt-4 text-ink-2">{VERDICT[ours.label](ours.gapPct)}</p>
        <PriceRange ours={ours} price={price} zestimate={zestimate} />
        {zestimate && zGap != null && (
          <p className="mt-4 text-sm text-ink-2">
            Zillow&apos;s Zestimate is {money(zestimate)}, about {Math.abs(zGap).toFixed(0)}% {zGap >= 0 ? "above" : "below"} our fair price. Across
            thousands of homes the Zestimate is the more accurate of the two (see the Our models tab), so treat the gap between them as the
            uncertainty.
          </p>
        )}
        {ours.why && ours.why.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm font-semibold">Why our model landed here</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-2">
              {ours.why.map((w) => (
                <li key={w.label} className="flex justify-between gap-4">
                  <span>{w.label}</span>
                  <span className="tabular-nums text-ink">{w.pct >= 0 ? "+" : "−"}{Math.abs(w.pct).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">Biggest effects on the price compared with an average Houston home, from our LightGBM model.</p>
          </div>
        )}
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
