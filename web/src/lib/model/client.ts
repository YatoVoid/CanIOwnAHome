import { z } from "zod";
import { compactMoney } from "@/lib/format";
import { matchesFilters, type Listing, type Search } from "@/lib/listing";
import { rowById, rowToListing } from "@/lib/listings-store";
import { mockRecommend } from "./mock";
import type { PredictInput } from "./predict-input";

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

function modelUrl(path: "/rent-to-own" | "/predict") {
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
  if (pct < 2) return `Priced in line with the model's estimate of ${compactMoney(r.predicted_price)}`;
  return r.delta_pct < 0
    ? `Priced ${pct}% below the model's estimate of ${compactMoney(r.predicted_price)}`
    : `Priced ${pct}% above the model's estimate of ${compactMoney(r.predicted_price)}`;
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
    ? { ...home, model: { predictedPrice: home.estimates.value, low: null, high: null, tier: null, score: null, reasons: [] } }
    : home;
}
