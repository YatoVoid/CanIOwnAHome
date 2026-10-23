import { describe, expect, it } from "vitest";
import { toChatResult } from "./chat";
import {
  costBreakdown,
  DEFAULT_ASSUMPTIONS,
  housingBudget,
  maxAffordablePrice,
  NEAR_RENT_FACTOR,
  withSavings,
} from "./finance";
import { parseSearch, searchQuery } from "./listing";
import { ourBestDeals, ourRecommend } from "./model/ours-search";

describe("parsing the search", () => {
  it("accepts rent only (old links), with or without a zip", () => {
    for (const params of [{ rent: "1500" }, { zip: "", rent: "1500" }, { zip: "  ", rent: "$1,500" }]) {
      const r = parseSearch(params);
      expect(r.success && r.data.zip).toBeUndefined();
      expect(r.success && r.data.income).toBeUndefined();
      expect(r.success && r.data.rent).toBe(1500);
    }
  });

  it("accepts the full form: income, rent, savings, optional debts and zip", () => {
    const r = parseSearch({ income: "$70,000", rent: "1,500", savings: "20,000", debts: "300", zip: "77033" });
    expect(r.success && r.data).toEqual({ zip: "77033", rent: 1500, income: 70000, savings: 20000, debts: 300, filters: {} });
    expect(r.success && searchQuery(r.data)).toBe("zip=77033&rent=1500&income=70000&savings=20000&debts=300");
  });

  it("accepts zero savings and leaves a blank zip and debts out", () => {
    const r = parseSearch({ income: "60000", rent: "1500", savings: "0", debts: "", zip: "" });
    expect(r.success && r.data.savings).toBe(0);
    expect(r.success && searchQuery(r.data)).toBe("rent=1500&income=60000&savings=0");
  });

  it("requires income and savings once the form sends either, and still rejects bad numbers", () => {
    const blankIncome = parseSearch({ income: "", rent: "1500", savings: "5000" });
    expect(blankIncome.success).toBe(false);
    expect(!blankIncome.success && blankIncome.error.issues.some((i) => i.path[0] === "income")).toBe(true);
    expect(parseSearch({ income: "70000", rent: "1500", savings: "" }).success).toBe(false);
    expect(parseSearch({ income: "500", rent: "1500", savings: "0" }).success).toBe(false);
    expect(parseSearch({ income: "70000", rent: "1500", savings: "0", zip: "7700" }).success).toBe(false);
  });

  it("lets the chat start a full search without a zip", () => {
    const empty = { reply: "ok", zip: null, monthlyRent: null, annualIncome: null, savings: null, monthlyDebts: null, householdSize: null, minBeds: null, minBaths: null, minSqft: null, minLotSqft: null, homeTypes: [] };
    const r = toChatResult({ ...empty, monthlyRent: 1500, annualIncome: 70000, savings: 20000, householdSize: 3 });
    expect(r.search).toEqual({ rent: 1500, income: 70000, savings: 20000, filters: { minBeds: 2 } });
  });
});

describe("affordability math", () => {
  it("uses the lower of 28% of income and 36% minus debts", () => {
    expect(housingBudget(70_000, 300)).toBeCloseTo(1633.33, 1);
    expect(housingBudget(70_000, 1_000)).toBeCloseTo(1100, 0); // 36% rule binds: 2100 - 1000
    expect(housingBudget(30_000, 1_000)).toBe(0); // debts leave no room
  });

  it("finds the top price whose full monthly cost fits, and more savings raise it", () => {
    const budget = housingBudget(70_000, 300);
    const price = maxAffordablePrice(budget, 20_000, DEFAULT_ASSUMPTIONS);
    const cost = (p: number) => costBreakdown(p, null, withSavings(p, DEFAULT_ASSUMPTIONS, 20_000)).total;
    expect(cost(price)).toBeLessThanOrEqual(budget);
    expect(cost(price + 2_000)).toBeGreaterThan(budget);
    expect(maxAffordablePrice(budget, 60_000, DEFAULT_ASSUMPTIONS)).toBeGreaterThan(price);
    expect(maxAffordablePrice(0, 20_000, DEFAULT_ASSUMPTIONS)).toBe(0);
  });

  it("turns savings into a down payment percentage for each price", () => {
    expect(withSavings(200_000, DEFAULT_ASSUMPTIONS, 20_000).downPaymentPct).toBeCloseTo(10);
    expect(withSavings(100_000, DEFAULT_ASSUMPTIONS, 500_000).downPaymentPct).toBe(100);
  });
});

describe("ranking with our models", () => {
  const full = { rent: 1500, income: 70_000, savings: 20_000, debts: 300 };
  const homes = ourRecommend({ ...full, filters: { minBeds: 3 } });

  it("returns homes across Houston that fit the affordability budget", () => {
    const budget = housingBudget(full.income, full.debts);
    expect(homes.length).toBeGreaterThan(3);
    expect(homes.length).toBeLessThanOrEqual(24);
    expect(new Set(homes.map((h) => h.address.zip)).size).toBeGreaterThan(2);
    for (const h of homes) {
      expect(costBreakdown(h.price, null, withSavings(h.price, DEFAULT_ASSUMPTIONS, full.savings)).total).toBeLessThanOrEqual(budget);
      expect(h.beds ?? 0).toBeGreaterThanOrEqual(3);
      expect(h.address.street).toMatch(/^\d/);
      expect(h.homeType).not.toBe("MANUFACTURED");
      expect(h.ours).toBeTruthy();
      expect(h.model?.reasons.length).toBeGreaterThan(0);
    }
  });

  it("never puts more than three homes from one zip when no zip is given", () => {
    const counts = new Map<string, number>();
    for (const h of homes) counts.set(h.address.zip, (counts.get(h.address.zip) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
  });

  it("lists bargains before fair prices, flood traps and overpriced homes", () => {
    const rank = { bargain: 0, fair: 1, overpriced: 2, flood_trap: 2 } as const;
    const tiers = homes.map((h) => rank[h.ours!.label]);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it("searches one zip (plus neighbours if needed) when given a zip", () => {
    const inZip = ourRecommend({ ...full, zip: "77033", filters: {} });
    expect(inZip.length).toBeGreaterThan(0);
    expect(inZip.filter((h) => h.address.zip === "77033").length).toBeGreaterThan(3);
  });

  it("falls back to rent as the budget for old links with no income", () => {
    const rent = 1800;
    const legacy = ourRecommend({ rent, filters: {} });
    expect(legacy.length).toBeGreaterThan(5);
    for (const h of legacy) expect(costBreakdown(h.price, null, DEFAULT_ASSUMPTIONS).total).toBeLessThanOrEqual(rent * NEAR_RENT_FACTOR);
  });

  it("best deals are bargains only, never absurdly cheap, and skip manufactured homes", () => {
    const deals = ourBestDeals({ ...full, filters: {} });
    expect(deals.length).toBeGreaterThan(0);
    for (const d of deals) {
      expect(d.ours!.label).toBe("bargain");
      expect(d.ours!.gapPct).toBeLessThanOrEqual(40);
      expect(d.homeType).not.toBe("MANUFACTURED");
    }
  });

  it("only shows manufactured homes when asked for", () => {
    const asked = ourRecommend({ ...full, rent: 2500, income: 120_000, filters: { homeTypes: ["MANUFACTURED"] } });
    expect(asked.length).toBeGreaterThan(0);
    for (const h of asked) expect(h.homeType).toBe("MANUFACTURED");
  });
});
