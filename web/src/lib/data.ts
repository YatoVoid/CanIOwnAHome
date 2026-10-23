import { cacheLife } from "next/cache";
import type { Search } from "@/lib/listing";
import { getListing, recommendHomes } from "@/lib/model/client";

export async function cachedRecommendations(search: Search) {
  "use cache";
  cacheLife("minutes");
  return recommendHomes({ zip: search.zip, rent: search.rent });
}

export async function cachedListing(id: string) {
  "use cache";
  cacheLife("hours");
  return getListing(id);
}
