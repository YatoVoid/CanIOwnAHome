import type { ChatMessage, ChatResult } from "@/lib/chat";
import { searchQuery, type Listing, type Search } from "@/lib/listing";
import type { DealScoreResult, OfferResult, PredictResult, RentToOwnResult } from "@/lib/model/client";
import type { OfferInput, PredictInput } from "@/lib/model/predict-input";

export class ApiError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

// One request per input per page load, shared by every component that needs
// it (results grid, previous/next links, verdict, price check). Failed
// requests are dropped so a retry goes back to the network.
const cache = new Map<string, Promise<unknown>>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let pending = cache.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load();
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

export function fetchRentToOwn(search: Search) {
  return once(`rent-to-own:${searchQuery(search)}`, () =>
    call<RentToOwnResult>("/api/rent-to-own", {
      method: "POST",
      body: JSON.stringify({ zip: search.zip, monthly_rent: search.rent, filters: search.filters }),
    }),
  );
}

export function fetchPredict(input: PredictInput) {
  const body = JSON.stringify(input);
  return once(`predict:${body}`, () => call<PredictResult>("/api/predict", { method: "POST", body }));
}

export function fetchDealScore(search: Search) {
  return once(`deal-score:${searchQuery(search)}`, () =>
    call<DealScoreResult>("/api/deal-score", {
      method: "POST",
      body: JSON.stringify({ zip: search.zip, monthly_rent: search.rent, filters: search.filters }),
    }),
  );
}

export function fetchOfferPrice(input: OfferInput) {
  const body = JSON.stringify(input);
  return once(`offer-price:${body}`, () => call<OfferResult>("/api/offer-price", { method: "POST", body }));
}

export function fetchDescription(id: string) {
  return once(`describe:${id}`, () =>
    call<{ text: string | null; generatedBy: string | null }>(`/api/describe?id=${encodeURIComponent(id)}`),
  );
}

export function postChat(messages: ChatMessage[]) {
  return call<ChatResult>("/api/chat", { method: "POST", body: JSON.stringify({ messages }) });
}

export function findInResults(result: RentToOwnResult, id: string): Listing | undefined {
  return result.homes.find((h) => h.id === id);
}
