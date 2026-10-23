import type { Listing } from "@/lib/listing";

type WithOurs = Pick<Listing, "ours">;

/** How many of these homes sit in each flood-claim level, and how many look cheap only because of flood risk. */
export function floodCounts(homes: WithOurs[]) {
  const c = { High: 0, Medium: 0, Low: 0, unknown: 0, traps: 0 };
  for (const h of homes) {
    const level = h.ours?.floodLevel;
    if (level) c[level]++;
    else c.unknown++;
    if (h.ours?.label === "flood_trap") c.traps++;
  }
  return c;
}

export function hideHighFlood<T extends WithOurs>(homes: T[]): T[] {
  return homes.filter((h) => h.ours?.floodLevel !== "High");
}

/** "More flood-insurance claims per listing than 45% of Houston zips." */
export function floodPercentile(score: number | null | undefined) {
  return score == null ? null : Math.round(score * 100);
}
