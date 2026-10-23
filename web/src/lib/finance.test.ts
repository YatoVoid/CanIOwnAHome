import { describe, expect, it } from "vitest";
import {
  costBreakdown,
  DEFAULT_ASSUMPTIONS,
  equityAfterYears,
  monthlyPrincipalInterest,
  remainingBalance,
  rentFit,
} from "./finance";

describe("monthlyPrincipalInterest", () => {
  it("matches the standard amortization formula", () => {
    expect(monthlyPrincipalInterest(300_000, 6, 30)).toBeCloseTo(1798.65, 2);
  });

  it("handles a zero rate and an empty loan", () => {
    expect(monthlyPrincipalInterest(360_000, 0, 30)).toBe(1000);
    expect(monthlyPrincipalInterest(0, 6, 30)).toBe(0);
  });
});

describe("costBreakdown", () => {
  it("adds PMI below 20% down and drops it at 20%", () => {
    const low = costBreakdown(300_000, null, { ...DEFAULT_ASSUMPTIONS, downPaymentPct: 5 });
    const high = costBreakdown(300_000, null, { ...DEFAULT_ASSUMPTIONS, downPaymentPct: 20 });
    expect(low.pmi).toBeGreaterThan(0);
    expect(high.pmi).toBe(0);
  });

  it("sums every part into the total and includes HOA", () => {
    const c = costBreakdown(250_000, 120, DEFAULT_ASSUMPTIONS);
    expect(c.total).toBeCloseTo(c.principalInterest + c.tax + c.insurance + c.pmi + 120, 6);
    expect(c.cashToClose).toBeCloseTo(c.downPayment + c.closingCosts, 6);
  });
});

describe("remainingBalance / equity", () => {
  it("is paid off at the end of the term", () => {
    expect(remainingBalance(200_000, 6, 30, 360)).toBeCloseTo(0, 0);
  });

  it("equity after 5 years exceeds the down payment", () => {
    const price = 300_000;
    const down = price * (DEFAULT_ASSUMPTIONS.downPaymentPct / 100);
    expect(equityAfterYears(price, DEFAULT_ASSUMPTIONS, 5)).toBeGreaterThan(down);
  });
});

describe("rentFit", () => {
  it("buckets cost relative to rent", () => {
    expect(rentFit(1900, 2000)).toBe("under");
    expect(rentFit(2200, 2000)).toBe("near");
    expect(rentFit(2400, 2000)).toBe("stretch");
  });
});
