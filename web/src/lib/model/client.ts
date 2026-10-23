import { z } from "zod";
import { compactMoney } from "@/lib/format";
import { matchesFilters, type Listing, type Search } from "@/lib/listing";
import { rowById, rowToListing } from "@/lib/listings-store";
import { ourBestDeals, ourRecommend } from "./ours-search";
import { mockRecommend } from "./mock";
import type { OfferInput, PredictInput } from "./predict-input";

const TIMEOUT_MS = 15_000;
const RETRIES = 1;
const MAX_RESULTS = 100;
// The rent-to-own API sizes the budget from rent plus cash down. The site doesn't
// ask for savings yet, so the budget is what the rent alone would cover.
const DOWN_PAYMENT = 0;

export class ModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ModelError";
  }
}

export function usingMockModel() {
  return !process.env.MODEL_API_URL;
}

function modelUrl(path: "/rent-to-own" | "/predict" | "/deal-score" | "/offer-price") {
  return `${process.env.MODEL_API_URL!.replace(/\/+$/, "")}${path}`;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status >= 500) {
        lastError = new ModelError(`Model API returned ${res.status}`, res.status);
        continue;
      }
      if (!res.ok) throw new ModelError(`Model API returned ${res.status}`, res.status);
      return await res.json();
    } catch (err) {
      if (err instanceof ModelError) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof ModelError
    ? lastError
    : new ModelError(`Model API unreachable: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

const optionalNumber = z.number().nullable().optional().catch(null);

const RecommendResultSchema = z.object({
  id: z
    .union([z.number(), z.string()])
    .transform(String)
    .pipe(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)),
  address: z.string().min(1).max(300),
  zipcode: z.string().regex(/^\d{5}$/),
  price: z.number().positive(),
  predicted_price: optionalNumber,
  delta_pct: optionalNumber,
  tier: z.enum(["GOOD_BUY", "NEGOTIATE", "OVERPRICED"]).nullable().optional().catch(null),
  beds: optionalNumber,
  baths: optionalNumber,
  sqft_living: optionalNumber,
  photo: z.string().nullable().optional().catch(null),
  detail_url: z.string().nullable().optional().catch(null),
});

type RecommendResult = z.infer<typeof RecommendResultSchema>;

const RecommendResponseSchema = z.object({
  results: z.array(z.unknown()).max(1000).default([]),
});

const PredictResponseSchema = z.object({
  predicted_price: z.number().positive(),
  low_estimate: z.number().nonnegative().nullable().optional(),
  high_estimate: z.number().nonnegative().nullable().optional(),
});

const https = (u: string | null | undefined) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

function reasonFor(r: RecommendResult): string | null {
  if (r.delta_pct == null || r.predicted_price == null) return null;
  const pct = Math.abs(Math.round(r.delta_pct));
  if (pct < 2) return `Priced in line with our hosted model's estimate of ${compactMoney(r.predicted_price)}`;
  return r.delta_pct < 0
    ? `Priced ${pct}% below our hosted model's estimate of ${compactMoney(r.predicted_price)}`
    : `Priced ${pct}% above our hosted model's estimate of ${compactMoney(r.predicted_price)}`;
}

function fromResult(r: RecommendResult): Listing {
  const [street, city = "Houston"] = r.address.split(",").map((p) => p.trim());
  return {
    id: r.id,
    address: { street, city: /^TX\b/.test(city) ? "Houston" : city, state: "TX", zip: r.zipcode },
    price: r.price,
    beds: r.beds ?? null,
    baths: r.baths ?? null,
    sqft: r.sqft_living ?? null,
    lotSqft: null,
    yearBuilt: null,
    homeType: "SINGLE_FAMILY",
    location: null,
    photos: [],
    hoaMonthly: null,
    estimates: { value: null, rent: null, taxAssessed: null },
    model: null,
    daysOnMarket: null,
    broker: null,
    sourceUrl: null,
  };
}

/** Model results carry a single small photo and no coordinates, so fill in from the listing data by id. */
export function toListing(r: RecommendResult): Listing {
  const row = rowById(r.id);
  const base = row ? rowToListing(row) : fromResult(r);
  const photo = https(r.photo);
  const reason = reasonFor(r);
  return {
    ...base,
    price: r.price,
    beds: base.beds ?? r.beds ?? null,
    baths: base.baths ?? r.baths ?? null,
    sqft: base.sqft ?? r.sqft_living ?? null,
    photos: base.photos.length > 0 ? base.photos : photo ? [photo] : [],
    sourceUrl: https(r.detail_url) ?? base.sourceUrl,
    model: {
      predictedPrice: r.predicted_price ?? null,
      low: null,
      high: null,
      tier: r.tier ?? null,
      score: null,
      dealScore: null,
      dealRating: null,
      reasons: reason ? [reason] : [],
    },
  };
}

export type RentToOwnResult = {
  /** The model endpoint that answered, or null when the stand-in model ran. */
  upstream: string | null;
  /** The model's response exactly as received. */
  model: unknown;
  homes: Listing[];
};

export async function rentToOwn(search: Search): Promise<RentToOwnResult> {
  // Searches with income (the form's flow), or with no zip, are ranked with our trained price model and scores.
  // Old links with only a zip and rent still go to the hosted model.
  if (search.income !== undefined || !search.zip) return { upstream: null, model: null, homes: ourRecommend(search) };
  if (usingMockModel()) return { upstream: null, model: null, homes: mockRecommend(search) };

  const upstream = modelUrl("/rent-to-own");
  const body = await postJson(upstream, {
    zip: search.zip,
    monthly_rent: search.rent,
    down_payment: DOWN_PAYMENT,
    n_results: MAX_RESULTS,
  });
  const parsed = RecommendResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error("rent-to-own API returned an invalid payload", parsed.error.issues.slice(0, 5));
    throw new ModelError("Model API returned an invalid payload");
  }

  const homes: Listing[] = [];
  for (const item of parsed.data.results) {
    const r = RecommendResultSchema.safeParse(item);
    if (!r.success) continue;
    const home = toListing(r.data);
    if (matchesFilters(home, search.filters)) homes.push(home);
  }
  return { upstream, model: body, homes };
}

export async function recommendHomes(search: Search): Promise<Listing[]> {
  return (await rentToOwn(search)).homes;
}

export type PredictResult = {
  upstream: string | null;
  prediction: z.infer<typeof PredictResponseSchema> | null;
};

export async function predict(input: PredictInput): Promise<PredictResult> {
  if (usingMockModel()) return { upstream: null, prediction: null };
  const upstream = modelUrl("/predict");
  const parsed = PredictResponseSchema.safeParse(await postJson(upstream, input));
  if (!parsed.success) {
    console.error("predict API returned an invalid payload", parsed.error.issues.slice(0, 5));
    throw new ModelError("Model API returned an invalid payload");
  }
  return { upstream, prediction: parsed.data };
}

export async function getListing(id: string): Promise<Listing | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const row = rowById(id);
  if (!row) return null;
  const home = rowToListing(row);
  return usingMockModel()
    ? {
        ...home,
        model: {
          predictedPrice: home.estimates.value,
          low: null,
          high: null,
          tier: null,
          score: null,
          dealScore: null,
          dealRating: null,
          reasons: [],
        },
      }
    : home;
}

const DealResultSchema = z.object({
  address: z.string().min(1).max(300),
  price: z.number().positive(),
  predicted: optionalNumber,
  value_gap_pct: optionalNumber,
  days_on_zillow: optionalNumber,
  deal_score: z.number().min(0).max(100),
  rating: z.string().max(80).nullable().optional().catch(null),
  beds: optionalNumber,
  baths: optionalNumber,
  sqft_living: optionalNumber,
  zipcode: z.string().regex(/^\d{5}$/),
  detail_url: z.string().nullable().optional().catch(null),
});

const DealResponseSchema = z.object({
  area: z.string().max(200).nullable().optional(),
  results: z.array(z.unknown()).max(1000).default([]),
});

/** "Strong Buy ⭐⭐⭐" becomes "Strong buy". */
export function cleanRating(rating: string | null | undefined) {
  const words = rating?.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, " ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : null;
}

function dealToListing(d: z.infer<typeof DealResultSchema>, id: string): Listing {
  const row = rowById(id);
  const base = row
    ? rowToListing(row)
    : fromResult({ id, address: d.address, zipcode: d.zipcode, price: d.price, beds: d.beds, baths: d.baths, sqft_living: d.sqft_living });
  const gap = d.value_gap_pct;
  const reasons = [
    gap != null && d.predicted != null
      ? gap >= 0
        ? `Priced ${Math.round(gap)}% below our hosted model's estimate of ${compactMoney(d.predicted)}`
        : `Priced ${Math.round(-gap)}% above our hosted model's estimate of ${compactMoney(d.predicted)}`
      : null,
    d.days_on_zillow != null ? `Listed for ${Math.round(d.days_on_zillow)} days` : null,
  ].filter((r): r is string => r !== null);
  return {
    ...base,
    price: d.price,
    beds: base.beds ?? d.beds ?? null,
    baths: base.baths ?? d.baths ?? null,
    sqft: base.sqft ?? d.sqft_living ?? null,
    daysOnMarket: base.daysOnMarket ?? (d.days_on_zillow != null ? Math.round(d.days_on_zillow) : null),
    sourceUrl: https(d.detail_url) ?? base.sourceUrl,
    model: {
      predictedPrice: d.predicted ?? null,
      low: null,
      high: null,
      tier: null,
      score: null,
      dealScore: d.deal_score,
      dealRating: cleanRating(d.rating),
      reasons,
    },
  };
}

export type DealScoreResult = RentToOwnResult;

const DEAL_CANDIDATES = 40;

/**
 * Best deals in a zip by the model's deal score, at any price. The endpoint
 * matches free text loosely ("all" returns the Galleria), so it is only ever
 * sent a zip, and results are dropped unless it echoes that zip back.
 */
export async function dealScore(search: Search): Promise<DealScoreResult> {
  if (search.income !== undefined || !search.zip) return { upstream: null, model: null, homes: ourBestDeals(search) };
  if (usingMockModel()) return { upstream: null, model: null, homes: [] };

  const upstream = modelUrl("/deal-score");
  const body = await postJson(upstream, { area: search.zip, n_results: DEAL_CANDIDATES });
  const parsed = DealResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error("deal-score API returned an invalid payload", parsed.error.issues.slice(0, 5));
    throw new ModelError("Model API returned an invalid payload");
  }
  if (parsed.data.area !== `Zip ${search.zip}`) {
    console.warn("deal-score answered for a different area", { asked: search.zip, got: parsed.data.area });
    return { upstream, model: body, homes: [] };
  }

  const homes: Listing[] = [];
  for (const item of parsed.data.results) {
    const d = DealResultSchema.safeParse(item);
    if (!d.success) continue;
    const id = /\/(\d{1,20})_zpid/.exec(d.data.detail_url ?? "")?.[1];
    if (!id) continue;
    const home = dealToListing(d.data, id);
    if (matchesFilters(home, search.filters)) homes.push(home);
  }
  return { upstream, model: body, homes };
}

const OfferSchema = z.object({ amount: z.number().positive(), reason: z.string().max(400) });

export const OfferResponseSchema = z.object({
  asking_price: z.number().positive(),
  model_estimate: z.number().positive(),
  confidence_range: z.string().max(100).nullable().optional(),
  value_verdict: z.string().max(300).nullable().optional(),
  gap_vs_model_pct: optionalNumber,
  days_on_market: optionalNumber,
  negotiation_room: z.string().max(20).nullable().optional(),
  offers: z.object({ competitive: OfferSchema, fair: OfferSchema, negotiated: OfferSchema }),
  reasoning: z
    .object({ value: z.string().max(400).nullable().optional(), timing: z.string().max(400).nullable().optional() })
    .nullable()
    .optional(),
});

export type OfferResult = { upstream: string | null; offer: z.infer<typeof OfferResponseSchema> | null };

export async function offerPrice(input: OfferInput): Promise<OfferResult> {
  if (usingMockModel()) return { upstream: null, offer: null };
  const upstream = modelUrl("/offer-price");
  const body = await postJson(upstream, input);
  const parsed = OfferResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error("offer-price API returned an invalid payload", parsed.error.issues.slice(0, 5));
    throw new ModelError("Model API returned an invalid payload");
  }
  // The endpoint fills in defaults for missing fields, so make sure it priced the home we asked about.
  if (parsed.data.asking_price !== input.asking_price) {
    throw new ModelError("offer-price answered for a different asking price");
  }
  return { upstream, offer: parsed.data };
}
