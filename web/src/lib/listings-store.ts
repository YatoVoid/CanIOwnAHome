import { readFileSync } from "node:fs";
import path from "node:path";
import type { Listing } from "@/lib/listing";
import { oursFor } from "@/lib/ours";

// Compact rows written by scripts/build-listings.py.
export type Row = {
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

type Meta = { ids: Record<string, string>; zips: Record<string, [number, number]> };

const DIR = path.join(process.cwd(), "data", "listings");
let meta: Meta | null = null;
const zipCache = new Map<string, Row[]>();

function loadMeta(): Meta {
  meta ??= JSON.parse(readFileSync(path.join(DIR, "meta.json"), "utf8")) as Meta;
  return meta;
}

/** Whether the listing data has any homes in this zip (it only covers the Houston area). */
export function zipCovered(zip: string) {
  return /^\d{5}$/.test(zip) && Boolean(loadMeta().zips[zip]);
}

export function rowsInZip(zip: string): Row[] {
  if (!/^\d{5}$/.test(zip) || !loadMeta().zips[zip]) return [];
  let rows = zipCache.get(zip);
  if (!rows) {
    rows = JSON.parse(readFileSync(path.join(DIR, `${zip}.json`), "utf8")) as Row[];
    zipCache.set(zip, rows);
  }
  return rows;
}

/** Every listing in every zip (loads all zip files once, then serves from memory). */
export function allRows(): Row[] {
  return Object.keys(loadMeta().zips).flatMap((z) => rowsInZip(z));
}

export function rowById(id: string): Row | null {
  const zip = loadMeta().ids[id];
  return zip ? (rowsInZip(zip).find((r) => r.id === id) ?? null) : null;
}

export function nearestZips(zip: string, count: number): string[] {
  const { zips } = loadMeta();
  const origin = zips[zip];
  if (!origin) return [];
  return Object.entries(zips)
    .filter(([z]) => z !== zip)
    .map(([z, [la, lo]]) => ({ z, d: (la - origin[0]) ** 2 + (lo - origin[1]) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((x) => x.z);
}

export function rowToListing(r: Row): Listing {
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
    model: null,
    ours: oursFor(r.id, r.z),
    daysOnMarket: r.dom,
    broker: r.br,
    sourceUrl: r.u?.startsWith("https://") ? r.u : null,
  };
}
