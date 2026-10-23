import { describe, expect, it } from "vitest";
import { toChatResult } from "./chat";
import { costBreakdown, DEFAULT_ASSUMPTIONS, NEAR_RENT_FACTOR } from "./finance";
import { parseSearch, searchQuery } from "./listing";
import { anywhereBestDeals, anywhereRecommend } from "./model/anywhere";

describe("search without a zip (anywhere in Houston)", () => {
  it("accepts a missing or blank zip", () => {
    for (const params of [{ rent: "1500" }, { zip: "", rent: "1500" }, { zip: "  ", rent: "$1,500" }]) {
      const r = parseSearch(params);
      expect(r.success && r.data.zip).toBeUndefined();
      expect(r.success && r.data.rent).toBe(1500);
    }
  });

  it("still rejects a malformed zip, and leaves zip out of the query when blank", () => {
    expect(parseSearch({ zip: "7700", rent: "1500" }).success).toBe(false);
    const r = parseSearch({ rent: "1500" });
    expect(r.success && searchQuery(r.data)).toBe("rent=1500");
  });

  it("lets the chat start a search without a zip", () => {
    const empty = { reply: "ok", zip: null, monthlyRent: null, householdSize: null, minBeds: null, minBaths: null, minSqft: null, minLotSqft: null, homeTypes: [] };
    expect(toChatResult({ ...empty, monthlyRent: 1500 }).search).toBeNull(); // still needs a bedroom count
    const r = toChatResult({ ...empty, monthlyRent: 1500, householdSize: 3 });
    expect(r.search).toEqual({ rent: 1500, filters: { minBeds: 2 } });
    expect(r.search && "zip" in r.search).toBe(false);
  });
});

describe("Houston-wide ranking", () => {
  const rent = 1800;
  const homes = anywhereRecommend({ rent, filters: { minBeds: 3 } });

  it("returns homes across several zips that fit the budget and filters", () => {
    expect(homes.length).toBeGreaterThan(5);
    expect(homes.length).toBeLessThanOrEqual(24);
    expect(new Set(homes.map((h) => h.address.zip)).size).toBeGreaterThan(2);
    for (const h of homes) {
      expect(costBreakdown(h.price, null, DEFAULT_ASSUMPTIONS).total).toBeLessThanOrEqual(rent * NEAR_RENT_FACTOR);
      expect(h.beds ?? 0).toBeGreaterThanOrEqual(3);
      expect(h.address.street).toMatch(/^\d/);
      expect(h.ours).toBeTruthy();
      expect(h.model?.reasons.length).toBeGreaterThan(0);
    }
  });

  it("never puts more than three homes from one zip", () => {
    const counts = new Map<string, number>();
    for (const h of homes) counts.set(h.address.zip, (counts.get(h.address.zip) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
  });

  it("lists bargains before fair prices, flood traps and overpriced homes", () => {
    const rank = { bargain: 0, fair: 1, overpriced: 2, flood_trap: 2 } as const;
    const tiers = homes.map((h) => rank[h.ours!.label]);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it("best deals are bargains only, never absurdly cheap, and skip manufactured homes", () => {
    const deals = anywhereBestDeals({ rent, filters: {} });
    expect(deals.length).toBeGreaterThan(0);
    for (const d of deals) {
      expect(d.ours!.label).toBe("bargain");
      expect(d.ours!.gapPct).toBeLessThanOrEqual(40);
      expect(d.homeType).not.toBe("MANUFACTURED");
    }
  });

  it("only shows manufactured homes when asked for", () => {
    expect(anywhereRecommend({ rent: 2500, filters: {} }).some((h) => h.homeType === "MANUFACTURED")).toBe(false);
    const asked = anywhereRecommend({ rent: 2500, filters: { homeTypes: ["MANUFACTURED"] } });
    expect(asked.length).toBeGreaterThan(0);
    for (const h of asked) expect(h.homeType).toBe("MANUFACTURED");
  });
});
