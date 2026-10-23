import { readFileSync } from "node:fs";
import path from "node:path";
import { costBreakdown, DEFAULT_ASSUMPTIONS, NEAR_RENT_FACTOR } from "@/lib/finance";
import { money } from "@/lib/format";
import type { Listing, Search } from "@/lib/listing";

// Compact rows written by scripts/build-mock-listings.py.
type Row = {
  id: string;
  s: string;
  c: string;
  z: string;
  p: number;
  bd: number | null;
  ba: number | null;
  sf: number | null;
  lot: number | null;
  t: string;
  la: number | null;
  lo: number | null;
  ze: number | null;
  rz: number | null;
  tx: number | null;
  dom: number | null;
  br: string | null;
  u: string | null;
  ph: string[];
};

const MAX_RESULTS = 24;
const MIN_IN_ZIP = 8;
const NEIGHBOR_ZIPS = 6;

let cache: { rows: Row[]; byId: Map<string, Row>; centroids: Map<string, [number, number]> } | null = null;

function load() {
  if (cache) return cache;
  const rows: Row[] = JSON.parse(readFileSync(path.join(process.cwd(), "data", "mock-listings.json"), "utf8"));
  const sums = new Map<string, [number, number, number]>();
  for (const r of rows) {
    if (r.la == null || r.lo == null) continue;
    const s = sums.get(r.z) ?? [0, 0, 0];
    sums.set(r.z, [s[0] + r.la, s[1] + r.lo, s[2] + 1]);
  }
  const centroids = new Map([...sums].map(([z, [la, lo, n]]) => [z, [la / n, lo / n] as [number, number]]));
  cache = { rows, byId: new Map(rows.map((r) => [r.id, r])), centroids };
  return cache;
}

function toListing(r: Row, reasons: string[] = []): Listing {
  return {
    id: r.id,
    address: { street: r.s, city: r.c, state: "TX", zip: r.z },
    price: r.p,
    beds: r.bd,
    baths: r.ba,
    sqft: r.sf,
    lotSqft: r.lot,
    yearBuilt: null,
    homeType: r.t,
    location: r.la != null && r.lo != null ? { lat: r.la, lng: r.lo } : null,
    photos: r.ph.map((h) => `https://photos.zillowstatic.com/fp/${h}-cc_ft_1536.jpg`),
    hoaMonthly: null,
    estimates: { value: r.ze, rent: r.rz, taxAssessed: r.tx },
    model: { predictedPrice: r.ze, score: null, reasons },
    daysOnMarket: r.dom,
    broker: r.br,
    sourceUrl: r.u?.startsWith("https://") ? r.u : null,
  };
}

function monthly(r: Row) {
  return costBreakdown(r.p, null, DEFAULT_ASSUMPTIONS).total;
}

function nearestZips(zip: string, centroids: Map<string, [number, number]>) {
  const origin = centroids.get(zip);
  if (!origin) return [];
  return [...centroids]
    .filter(([z]) => z !== zip)
    .map(([z, [la, lo]]) => ({ z, d: (la - origin[0]) ** 2 + (lo - origin[1]) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, NEIGHBOR_ZIPS)
    .map((x) => x.z);
}

/**
 * Stand-in for the real model: homes whose estimated monthly cost (default
 * assumptions) is at most NEAR_RENT_FACTOR x rent, closest to the rent first.
 * Falls back to neighboring zips when the requested zip has too few matches.
 */
export function mockRecommend({ zip, rent }: Search): Listing[] {
  const { rows, centroids } = load();
  const ceiling = rent * NEAR_RENT_FACTOR;
  const fits = (r: Row) => monthly(r) <= ceiling;

  let picked = rows.filter((r) => r.z === zip && fits(r));
  if (picked.length < MIN_IN_ZIP) {
    const nearby = new Set(nearestZips(zip, centroids));
    picked = picked.concat(rows.filter((r) => nearby.has(r.z) && fits(r)));
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
      return toListing(r, reasons);
    });
}

export function mockListing(id: string): Listing | null {
  const row = load().byId.get(id);
  return row ? toListing(row) : null;
}
