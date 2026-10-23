import { describe, expect, it } from "vitest";
import { ChatHistorySchema, toChatResult, type Extraction } from "./chat";

const empty: Extraction = {
  reply: "What is your yearly income?",
  zip: null,
  monthlyRent: null,
  annualIncome: null,
  savings: null,
  monthlyDebts: null,
  householdSize: null,
  minBeds: null,
  minBaths: null,
  minSqft: null,
  minLotSqft: null,
  homeTypes: [],
};

describe("toChatResult", () => {
  it("holds the search until income, rent, savings and bedrooms are known", () => {
    expect(toChatResult({ ...empty, zip: "77044", monthlyRent: 2100, householdSize: 5 }).search).toBeNull();
    expect(toChatResult({ ...empty, monthlyRent: 2100, annualIncome: 80000, savings: 15000 }).search).toBeNull();
    const r = toChatResult({ ...empty, zip: "77044", monthlyRent: 2100, annualIncome: 80000, savings: 15000, householdSize: 5 });
    expect(r.search).toEqual({ zip: "77044", rent: 2100, income: 80000, savings: 15000, filters: { minBeds: 4 } });
  });

  it("treats zero savings as known, and keeps optional debts and zip out when not given", () => {
    const r = toChatResult({ ...empty, monthlyRent: 1500, annualIncome: 60000, savings: 0, householdSize: 2 });
    expect(r.search).toEqual({ rent: 1500, income: 60000, savings: 0, filters: { minBeds: 1 } });
    expect(r.search && "zip" in r.search).toBe(false);
    const withDebts = toChatResult({ ...empty, monthlyRent: 1500, annualIncome: 60000, savings: 5000, monthlyDebts: 400, householdSize: 2 });
    expect(withDebts.search?.debts).toBe(400);
  });

  it("ignores invalid values the model proposes", () => {
    const r = toChatResult({
      ...empty,
      zip: "7704",
      monthlyRent: 50,
      annualIncome: 500,
      minBeds: 3,
      minLotSqft: 5000,
      homeTypes: ["SINGLE_FAMILY", "SPACESHIP"],
    });
    expect(r.search).toBeNull();
    expect(r.known.zip).toBeNull();
    expect(r.known.rent).toBeNull();
    expect(r.known.income).toBeNull();
    expect(r.known.filters).toEqual({ minBeds: 3, minLotSqft: 5000, homeTypes: ["SINGLE_FAMILY"] });
  });

  it("treats every home type selected as no type filter", () => {
    const r = toChatResult({
      ...empty,
      homeTypes: ["SINGLE_FAMILY", "TOWNHOUSE", "CONDO", "MULTI_FAMILY", "MANUFACTURED"],
    });
    expect(r.known.filters.homeTypes).toBeUndefined();
  });
});

describe("ChatHistorySchema", () => {
  it("requires the last message to be from the user and caps length", () => {
    expect(ChatHistorySchema.safeParse([{ role: "user", text: "hi" }]).success).toBe(true);
    expect(ChatHistorySchema.safeParse([{ role: "assistant", text: "hi" }]).success).toBe(false);
    expect(ChatHistorySchema.safeParse([{ role: "user", text: "x".repeat(801) }]).success).toBe(false);
    expect(ChatHistorySchema.safeParse([{ role: "system", text: "hi" }]).success).toBe(false);
  });
});
