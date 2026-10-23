import { costBreakdown, DEFAULT_ASSUMPTIONS, housingBudget, NEAR_RENT_FACTOR, withSavings } from "@/lib/finance";
import { compactMoney, money } from "@/lib/format";
import { matchesFilters, type Listing, type Ours, type Search } from "@/lib/listing";
import { allRows, nearestZips, rowsInZip, rowToListing, type Row } from "@/lib/listings-store";
import { oursFor } from "@/lib/ours";

// Search ranked by our trained price model (fair price, deal label, flood level: lib/ours.ts).
//  - With income: the budget comes from the affordability rules (lib/finance.ts housingBudget), savings are the down payment.
//  - Without income (old links): rent x NEAR_RENT_FACTOR is the budget.
//  - With a zip: that zip, plus neighbours if it has too few matches. Without: all of Houston, at most 3 homes per zip.
const MAX_RESULTS = 24;
const PER_ZIP = 3;
const MIN_IN_ZIP = 8;
const NEIGHBOR_ZIPS = 6;
const GAP_PEAK = 25; // beyond ~25% below "fair" is more often model error or condition than a real deal
const GAP_MAX = 40; // never call anything past this a bargain

type Candidate = { home: Listing; ours: Ours; cost: number };

const tier = (o: Ours) => (o.label === "bargain" ? 0 : o.label === "fair" ? 1 : 2); // flood traps and overpriced last

/** Higher is better, peaking at GAP_PEAK% below fair and falling after it (a huge gap is a warning sign, not a deal). */
const valueScore = (gapPct: number) => (gapPct <= GAP_PEAK ? gapPct : GAP_PEAK - (gapPct - GAP_PEAK));

function monthlyCost(price: number, { income, savings }: Search) {
  const a = income !== undefined ? withSavings(price, DEFAULT_ASSUMPTIONS, savings ?? 0) : DEFAULT_ASSUMPTIONS;
  return costBreakdown(price, null, a).total;
}

function budgetOf(search: Search) {
  return search.income !== undefined ? housingBudget(search.income, search.debts ?? 0) : search.rent * NEAR_RENT_FACTOR;
}

function usable(r: Row, filters: Search["filters"]) {
  // Trailers and manufactured homes are priced very differently and the model is unreliable on them: only show on request.
  if (r.t === "MANUFACTURED" && !filters.homeTypes?.includes("MANUFACTURED")) return false;
  if (!/^\d/.test(r.s)) return false; // builder floor-plan listings ("The Jenny Plan, ...") have no street address
  return matchesFilters({ beds: r.bd, baths: r.ba, sqft: r.sf, lotSqft: r.lot, homeType: r.t }, filters);
}

function collect(search: Search, keep: (c: Candidate) => boolean): Candidate[] {
  const from = (rows: Row[]) => {
    const out: Candidate[] = [];
    for (const r of rows) {
      if (!usable(r, search.filters)) continue;
      const home = rowToListing(r);
      if (!home.ours) continue;
      const c = { home, ours: home.ours, cost: monthlyCost(r.p, search) };
      if (keep(c)) out.push(c);
    }
    return out;
  };
  if (!search.zip) return from(allRows());
  let out = from(rowsInZip(search.zip));
  if (out.length < MIN_IN_ZIP) for (const z of nearestZips(search.zip, NEIGHBOR_ZIPS)) out = out.concat(from(rowsInZip(z)));
  return out;
}

/** Prices of every home the site can recommend (scored, real street address, not manufactured). Used by the What if? page. */
export function usablePrices(): number[] {
  return allRows()
    .filter((r) => usable(r, {}) && oursFor(r.id, r.z))
    .map((r) => r.p);
}

function pickSpread(sorted: Candidate[], limit: number, perZip: number) {
  const counts = new Map<string, number>();
  const picked: Candidate[] = [];
  for (const c of sorted) {
    const n = counts.get(c.home.address.zip) ?? 0;
    if (n >= perZip) continue;
    counts.set(c.home.address.zip, n + 1);
    picked.push(c);
    if (picked.length === limit) break;
  }
  return picked;
}

function withReasons({ home, ours, cost }: Candidate, search: Search, showRent: boolean): Listing {
  const reasons: string[] = [];
  if (showRent) {
    const diff = cost - search.rent;
    reasons.push(diff <= 0 ? `About ${money(-diff)} a month less than your rent` : `About ${money(diff)} a month more than your rent`);
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

/** Homes whose full monthly cost fits the budget, best value first. */
export function ourRecommend(search: Search): Listing[] {
  const budget = budgetOf(search);
  const sorted = collect(search, (c) => c.cost <= budget).sort(
    (a, b) =>
      tier(a.ours) - tier(b.ours) ||
      valueScore(b.ours.gapPct) - valueScore(a.ours.gapPct) ||
      Math.abs(a.cost - budget) - Math.abs(b.cost - budget),
  );
  return pickSpread(sorted, MAX_RESULTS, search.zip ? Infinity : PER_ZIP).map((c) => withReasons(c, search, true));
}

/** The best-value homes at any price: bargains only (all three models agree), most underpriced first. */
export function ourBestDeals(search: Search): Listing[] {
  const sorted = collect(search, (c) => c.ours.label === "bargain" && c.ours.gapPct <= GAP_MAX).sort(
    (a, b) => valueScore(b.ours.gapPct) - valueScore(a.ours.gapPct) || a.cost - b.cost,
  );
  return pickSpread(sorted, 12, search.zip ? Infinity : PER_ZIP).map((c) => withReasons(c, search, true));
}
