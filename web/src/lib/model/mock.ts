import { costBreakdown, DEFAULT_ASSUMPTIONS, NEAR_RENT_FACTOR } from "@/lib/finance";
import { money } from "@/lib/format";
import { matchesFilters, type Listing, type Search } from "@/lib/listing";
import { nearestZips, rowsInZip, rowToListing, type Row } from "@/lib/listings-store";

const MAX_RESULTS = 24;
const MIN_IN_ZIP = 8;
const NEIGHBOR_ZIPS = 6;

function monthly(r: Row) {
  return costBreakdown(r.p, null, DEFAULT_ASSUMPTIONS).total;
}

/**
 * Stand-in for the model API when MODEL_API_URL is unset: homes whose
 * estimated monthly cost (default assumptions) is at most NEAR_RENT_FACTOR x
 * rent, closest to the rent first. Applies the search filters, and falls back
 * to neighboring zips when the requested zip has too few matches.
 */
export function mockRecommend({ zip, rent, filters }: Search): Listing[] {
  const ceiling = rent * NEAR_RENT_FACTOR;
  const fits = (r: Row) =>
    monthly(r) <= ceiling &&
    matchesFilters({ beds: r.bd, baths: r.ba, sqft: r.sf, lotSqft: r.lot, homeType: r.t }, filters);

  let picked = rowsInZip(zip).filter(fits);
  if (picked.length < MIN_IN_ZIP) {
    for (const z of nearestZips(zip, NEIGHBOR_ZIPS)) picked = picked.concat(rowsInZip(z).filter(fits));
  }

  return picked
    .map((r) => ({ r, cost: monthly(r) }))
    .sort((a, b) => Math.abs(a.cost - rent) - Math.abs(b.cost - rent))
    .slice(0, MAX_RESULTS)
    .map(({ r, cost }) => {
      const diff = cost - rent;
      const reasons = [
        diff <= 0
          ? `About ${money(-diff)} a month less than your rent`
          : `About ${money(diff)} a month more than your rent`,
      ];
      if (r.z !== zip) reasons.push(`Nearby zip ${r.z}`);
      if (r.rz && r.rz >= rent) reasons.push(`Similar homes here rent for about ${money(r.rz)}`);
      const home = rowToListing(r);
      return {
        ...home,
        model: {
          predictedPrice: r.ze,
          low: null,
          high: null,
          tier: null,
          score: null,
          dealScore: null,
          dealRating: null,
          reasons,
        },
      };
    });
}
