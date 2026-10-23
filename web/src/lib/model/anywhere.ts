import { costBreakdown, DEFAULT_ASSUMPTIONS, NEAR_RENT_FACTOR } from "@/lib/finance";
import { compactMoney, money } from "@/lib/format";
import { matchesFilters, type Listing, type Ours, type Search } from "@/lib/listing";
import { allRows, rowToListing } from "@/lib/listings-store";

// Houston-wide search (no zip). The hosted model needs a zip, so this ranks every listing
// with our own scores (fair price, deal label, flood level) from lib/ours.ts.
const MAX_RESULTS = 24;
const PER_ZIP = 3;
const GAP_PEAK = 25; // beyond ~25% below "fair" is more often model error or condition than a real deal
const GAP_MAX = 40; // never call anything past this a bargain

type Candidate = { home: Listing; ours: Ours; cost: number };

const tier = (o: Ours) => (o.label === "bargain" ? 0 : o.label === "fair" ? 1 : 2); // flood traps and overpriced last

/** Higher is better, peaking at GAP_PEAK% below fair and falling after it (a huge gap is a warning sign, not a deal). */
const valueScore = (gapPct: number) => (gapPct <= GAP_PEAK ? gapPct : GAP_PEAK - (gapPct - GAP_PEAK));

function candidates(filters: Search["filters"], keep: (c: Candidate) => boolean): Candidate[] {
  const out: Candidate[] = [];
  for (const r of allRows()) {
    // Trailers and manufactured homes are priced very differently and the model is unreliable on them: only show on request.
    if (r.t === "MANUFACTURED" && !filters.homeTypes?.includes("MANUFACTURED")) continue;
    if (!/^\d/.test(r.s)) continue; // builder floor-plan listings ("The Jenny Plan, ...") have no street address
    if (!matchesFilters({ beds: r.bd, baths: r.ba, sqft: r.sf, lotSqft: r.lot, homeType: r.t }, filters)) continue;
    const home = rowToListing(r);
    if (!home.ours) continue;
    const c = { home, ours: home.ours, cost: costBreakdown(r.p, null, DEFAULT_ASSUMPTIONS).total };
    if (keep(c)) out.push(c);
  }
  return out;
}

function pickSpread(sorted: Candidate[], limit: number) {
  const perZip = new Map<string, number>();
  const picked: Candidate[] = [];
  for (const c of sorted) {
    const n = perZip.get(c.home.address.zip) ?? 0;
    if (n >= PER_ZIP) continue;
    perZip.set(c.home.address.zip, n + 1);
    picked.push(c);
    if (picked.length === limit) break;
  }
  return picked;
}

function withReasons({ home, ours, cost }: Candidate, rent: number | null): Listing {
  const reasons: string[] = [];
  if (rent != null) {
    const diff = cost - rent;
    reasons.push(diff <= 0 ? `About ${money(-diff)} a month under your budget` : `About ${money(diff)} a month over your budget`);
  }
  reasons.push(
    ours.gapPct >= 0
      ? `Asking price is ${Math.round(ours.gapPct)}% below our fair-price estimate of ${compactMoney(ours.fairPrice)}`
      : `Asking price is ${Math.round(-ours.gapPct)}% above our fair-price estimate of ${compactMoney(ours.fairPrice)}`,
  );
  if (ours.floodLevel === "High") reasons.push("This zip has a high rate of flood-insurance claims");
  return {
    ...home,
    model: { predictedPrice: ours.fairPrice, low: null, high: null, tier: null, score: null, dealScore: null, dealRating: null, reasons },
  };
}

/** Homes anywhere in Houston whose full monthly cost fits the budget, best value first. */
export function anywhereRecommend({ rent, filters }: Search): Listing[] {
  const ceiling = rent * NEAR_RENT_FACTOR;
  const sorted = candidates(filters, (c) => c.cost <= ceiling).sort(
    (a, b) =>
      tier(a.ours) - tier(b.ours) ||
      valueScore(b.ours.gapPct) - valueScore(a.ours.gapPct) ||
      Math.abs(a.cost - rent) - Math.abs(b.cost - rent),
  );
  return pickSpread(sorted, MAX_RESULTS).map((c) => withReasons(c, rent));
}

/** The best-value homes in Houston at any price: bargains only (all three models agree), most underpriced first. */
export function anywhereBestDeals({ filters }: Search): Listing[] {
  const sorted = candidates(filters, (c) => c.ours.label === "bargain" && c.ours.gapPct <= GAP_MAX).sort(
    (a, b) => valueScore(b.ours.gapPct) - valueScore(a.ours.gapPct) || a.cost - b.cost,
  );
  return pickSpread(sorted, 12).map((c) => withReasons(c, null));
}
