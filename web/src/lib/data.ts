import { cacheLife } from "next/cache";
import type { Search } from "@/lib/listing";
import { dealScore, getListing, offerPrice, predict, rentToOwn } from "@/lib/model/client";
import type { OfferInput, PredictInput } from "@/lib/model/predict-input";

export async function cachedRentToOwn(search: Search) {
  "use cache";
  cacheLife("minutes");
  return rentToOwn(search);
}

export async function cachedPredict(input: PredictInput) {
  "use cache";
  cacheLife("hours");
  return predict(input);
}

export async function cachedListing(id: string) {
  "use cache";
  cacheLife("hours");
  return getListing(id);
}

export async function cachedDealScore(search: Search) {
  "use cache";
  cacheLife("minutes");
  return dealScore(search);
}

export async function cachedOfferPrice(input: OfferInput) {
  "use cache";
  cacheLife("hours");
  return offerPrice(input);
}
