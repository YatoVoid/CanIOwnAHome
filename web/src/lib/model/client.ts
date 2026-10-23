import { ListingSchema, RecommendResponseSchema, type Listing, type Search } from "@/lib/listing";
import { mockListing, mockRecommend } from "./mock";

const TIMEOUT_MS = 10_000;
const RETRIES = 1;

export class ModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ModelError";
  }
}

export function usingMockModel() {
  return !process.env.MODEL_API_URL;
}

async function callModel(path: string, init: RequestInit = {}): Promise<unknown | null> {
  const base = process.env.MODEL_API_URL!.replace(/\/+$/, "");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (process.env.MODEL_API_KEY) headers.set("Authorization", `Bearer ${process.env.MODEL_API_KEY}`);

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404) return null;
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

export async function recommendHomes(search: Search): Promise<Listing[]> {
  if (usingMockModel()) return mockRecommend(search);

  const body = await callModel("/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zip: search.zip, monthlyRent: search.rent }),
  });
  const parsed = RecommendResponseSchema.safeParse(body);
  if (!parsed.success) {
    console.error("model /recommend returned an invalid payload", parsed.error.issues.slice(0, 5));
    throw new ModelError("Model API returned an invalid payload");
  }
  return parsed.data.homes;
}

export async function getListing(id: string): Promise<Listing | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  if (usingMockModel()) return mockListing(id);

  const body = await callModel(`/listings/${encodeURIComponent(id)}`);
  if (body === null) return null;
  const parsed = ListingSchema.safeParse(body);
  if (!parsed.success) {
    console.error("model /listings returned an invalid payload", parsed.error.issues.slice(0, 5));
    throw new ModelError("Model API returned an invalid payload");
  }
  return parsed.data;
}
