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
      score: z.number().min(0).max(1).nullable(),
      reasons: z.array(z.string().max(300)).max(6),
    })
    .nullable()
    .default(null),
  daysOnMarket: z.number().int().nonnegative().nullable(),
  broker: z.string().max(200).nullable(),
  sourceUrl: httpsUrl.nullable(),
});

export type Listing = z.infer<typeof ListingSchema>;

export const RecommendResponseSchema = z.object({
  homes: z.array(ListingSchema).max(100),
});

export const SearchSchema = z.object({
  zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit zip code"),
  rent: z.coerce
    .number({ error: "Enter your monthly rent" })
    .int("Round your rent to whole dollars")
    .min(300, "Rent must be at least $300")
    .max(20_000, "Rent must be under $20,000"),
});

export type Search = z.infer<typeof SearchSchema>;

export function parseSearch(params: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return SearchSchema.safeParse({
    zip: first(params.zip) ?? "",
    rent: (first(params.rent) ?? "").replace(/[$,\s]/g, ""),
  });
}

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
