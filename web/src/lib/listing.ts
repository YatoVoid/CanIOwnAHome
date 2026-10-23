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
      dealScore: z.number().min(0).max(100).nullable().default(null),
      dealRating: z.string().max(60).nullable().default(null),
      reasons: z.array(z.string().max(300)).max(6).default([]),
    })
    .nullable()
    .default(null),
  daysOnMarket: z.number().int().nonnegative().nullable(),
  broker: z.string().max(200).nullable(),
  sourceUrl: httpsUrl.nullable(),
  // Fair price, deal label and ZIP flood level from the notebook's models (see lib/ours.ts).
  ours: z
    .object({
      fairPrice: money,
      gapPct: z.number(), // positive = asking price is this many % below fair price
      label: z.enum(["bargain", "fair", "overpriced", "flood_trap"]),
      // The spread of our three tree models around the fair price.
      low: money.nullish(),
      high: money.nullish(),
      // The three biggest drivers of the price, as % effect versus an average home.
      why: z.array(z.object({ label: z.string(), pct: z.number() })).nullish(),
      floodScore: z.number().min(0).max(1).nullable(),
      floodLevel: z.enum(["Low", "Medium", "High"]).nullable(),
    })
    .nullish(),
});

export type Listing = z.infer<typeof ListingSchema>;
export type Ours = NonNullable<Listing["ours"]>;

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
  // Optional: no zip means "anywhere in Houston".
  zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit zip code, or leave it blank to search all of Houston").optional(),
  // What the person pays in rent each month. (In old links with no income, it doubles as the monthly budget.)
  rent: z.coerce
    .number({ error: "Enter what you pay in rent each month" })
    .int("Round your rent to whole dollars")
    .min(300, "Rent must be at least $300")
    .max(20_000, "Rent must be under $20,000"),
  // Yearly income before taxes, cash savings (used as the down payment) and monthly debts. With income, the site
  // works out what the person can afford; without it, it falls back to treating rent as the budget.
  income: z.coerce
    .number({ error: "Enter your yearly income before taxes" })
    .int("Round your income to whole dollars")
    .min(12_000, "Income must be at least $12,000 a year")
    .max(2_000_000, "Income must be under $2,000,000 a year")
    .optional(),
  savings: z.coerce
    .number({ error: "Enter your savings (0 if none)" })
    .int("Round your savings to whole dollars")
    .min(0, "Savings cannot be negative")
    .max(5_000_000, "Savings must be under $5,000,000")
    .optional(),
  debts: z.coerce
    .number({ error: "Enter your monthly debts (0 if none)" })
    .int("Round your debts to whole dollars")
    .min(0, "Debts cannot be negative")
    .max(50_000, "Debts must be under $50,000 a month")
    .optional(),
});

/** The full search from the form: income and savings are required (debts default to 0). */
const FullSearchSchema = SearchSchema.extend({ income: SearchSchema.shape.income.unwrap(), savings: SearchSchema.shape.savings.unwrap() });

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

const cleanNumber = (v: string | string[] | undefined) => first(v)?.replace(/[$,\s]/g, "") || undefined;

export function parseSearch(params: Params) {
  // If the form sent income or savings (even blank), both are required. Old links with neither still work.
  const fromForm = params.income !== undefined || params.savings !== undefined;
  const base = (fromForm ? FullSearchSchema : SearchSchema).safeParse({
    zip: first(params.zip)?.trim() || undefined,
    rent: (first(params.rent) ?? "").replace(/[$,\s]/g, ""),
    income: cleanNumber(params.income),
    savings: cleanNumber(params.savings),
    debts: cleanNumber(params.debts),
  });
  if (!base.success) return base;
  return { success: true as const, data: { ...base.data, filters: parseFilters(params) } satisfies Search };
}

export function searchQuery({ zip, rent, income, savings, debts, filters }: Search) {
  const q = new URLSearchParams();
  if (zip) q.set("zip", zip);
  q.set("rent", String(rent));
  if (income !== undefined) q.set("income", String(income));
  if (savings !== undefined) q.set("savings", String(savings));
  if (debts) q.set("debts", String(debts));
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
