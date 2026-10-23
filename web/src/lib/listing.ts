import { z } from "zod";

const httpsUrl = z.url({ protocol: /^https$/ });
const money = z.number().nonnegative();

export const ListingSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  address: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}$/),
  }),
  price: z.number().positive(),
  beds: z.number().nonnegative().nullable(),
  baths: z.number().nonnegative().nullable(),
  sqft: z.number().positive().nullable(),
  lotSqft: z.number().positive().nullable(),
  yearBuilt: z.number().int().min(1700).max(2100).nullable().default(null),
  homeType: z.string().max(40),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  photos: z.array(httpsUrl).max(60),
  hoaMonthly: money.nullable().default(null),
  estimates: z.object({
    value: money.nullable(),
    rent: money.nullable(),
    taxAssessed: money.nullable(),
  }),
  model: z
    .object({
      predictedPrice: money.nullable(),
      low: money.nullable().default(null),
      high: money.nullable().default(null),
      tier: z.enum(["GOOD_BUY", "NEGOTIATE", "OVERPRICED"]).nullable().default(null),
      score: z.number().min(0).max(1).nullable().default(null),
      reasons: z.array(z.string().max(300)).max(6).default([]),
    })
    .nullable()
    .default(null),
  daysOnMarket: z.number().int().nonnegative().nullable(),
  broker: z.string().max(200).nullable(),
  sourceUrl: httpsUrl.nullable(),
});

export type Listing = z.infer<typeof ListingSchema>;

export const HOME_TYPES = ["SINGLE_FAMILY", "TOWNHOUSE", "CONDO", "MULTI_FAMILY", "MANUFACTURED"] as const;
export type HomeType = (typeof HOME_TYPES)[number];

export const FiltersSchema = z.object({
  minBeds: z.number().int().min(1).max(10).optional(),
  minBaths: z.number().min(1).max(10).optional(),
  minSqft: z.number().int().min(200).max(20_000).optional(),
  minLotSqft: z.number().int().min(500).max(2_000_000).optional(),
  homeTypes: z.array(z.enum(HOME_TYPES)).min(1).max(HOME_TYPES.length).optional(),
});

export type Filters = z.infer<typeof FiltersSchema>;

export const SearchSchema = z.object({
  zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit zip code"),
  rent: z.coerce
    .number({ error: "Enter your monthly rent" })
    .int("Round your rent to whole dollars")
    .min(300, "Rent must be at least $300")
    .max(20_000, "Rent must be under $20,000"),
});

export type Search = z.infer<typeof SearchSchema> & { filters: Filters };

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const FILTER_PARAMS = { beds: "minBeds", baths: "minBaths", sqft: "minSqft", lot: "minLotSqft" } as const;

/** Invalid filter params are dropped rather than failing the whole search. */
export function parseFilters(params: Params): Filters {
  const filters: Filters = {};
  for (const [param, key] of Object.entries(FILTER_PARAMS)) {
    const raw = first(params[param]);
    if (!raw) continue;
    const parsed = FiltersSchema.shape[key].safeParse(Number(raw));
    if (parsed.success && parsed.data !== undefined) Object.assign(filters, { [key]: parsed.data });
  }
  const types = first(params.type)?.split(",").filter(Boolean);
  if (types?.length) {
    const parsed = FiltersSchema.shape.homeTypes.safeParse([...new Set(types)]);
    if (parsed.success) filters.homeTypes = parsed.data;
  }
  return filters;
}

export function parseSearch(params: Params) {
  const base = SearchSchema.safeParse({
    zip: first(params.zip) ?? "",
    rent: (first(params.rent) ?? "").replace(/[$,\s]/g, ""),
  });
  if (!base.success) return base;
  return { success: true as const, data: { ...base.data, filters: parseFilters(params) } satisfies Search };
}

export function searchQuery({ zip, rent, filters }: Search) {
  const q = new URLSearchParams({ zip, rent: String(rent) });
  for (const [param, key] of Object.entries(FILTER_PARAMS)) {
    const v = filters[key];
    if (v !== undefined) q.set(param, String(v));
  }
  if (filters.homeTypes?.length) q.set("type", filters.homeTypes.join(","));
  return q.toString();
}

export function matchesFilters(l: Pick<Listing, "beds" | "baths" | "sqft" | "lotSqft" | "homeType">, f: Filters) {
  if (f.minBeds !== undefined && (l.beds ?? 0) < f.minBeds) return false;
  if (f.minBaths !== undefined && (l.baths ?? 0) < f.minBaths) return false;
  if (f.minSqft !== undefined && (l.sqft ?? 0) < f.minSqft) return false;
  if (f.minLotSqft !== undefined && (l.lotSqft ?? 0) < f.minLotSqft) return false;
  if (f.homeTypes?.length && !f.homeTypes.includes(l.homeType as HomeType)) return false;
  return true;
}

export function describeFilters(f: Filters) {
  const parts: string[] = [];
  if (f.minBeds !== undefined) parts.push(`${f.minBeds}+ bedrooms`);
  if (f.minBaths !== undefined) parts.push(`${f.minBaths}+ bathrooms`);
  if (f.minSqft !== undefined) parts.push(`${f.minSqft.toLocaleString("en-US")}+ sqft`);
  if (f.minLotSqft !== undefined) parts.push(`lot ${f.minLotSqft.toLocaleString("en-US")}+ sqft`);
  if (f.homeTypes?.length) parts.push(f.homeTypes.map(homeTypeLabel).join(" or "));
  return parts;
}

export type Tier = NonNullable<NonNullable<Listing["model"]>["tier"]>;

export const TIER_LABELS: Record<Tier, string> = {
  GOOD_BUY: "Good buy",
  NEGOTIATE: "Room to negotiate",
  OVERPRICED: "Overpriced",
};

export function homeTypeLabel(type: string) {
  const labels: Record<string, string> = {
    SINGLE_FAMILY: "Single-family",
    TOWNHOUSE: "Townhouse",
    CONDO: "Condo",
    MULTI_FAMILY: "Multi-family",
    MANUFACTURED: "Manufactured",
  };
  return labels[type] ?? type.toLowerCase().replace(/_/g, " ");
}
