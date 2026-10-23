import { cacheLife } from "next/cache";
import type { Search } from "@/lib/listing";
import { getListing, predict, rentToOwn } from "@/lib/model/client";
import type { PredictInput } from "@/lib/model/predict-input";

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
