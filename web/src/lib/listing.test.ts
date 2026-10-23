import { describe, expect, it } from "vitest";
import { ListingSchema, matchesFilters, parseSearch, searchQuery } from "./listing";

describe("parseSearch", () => {
  it("accepts a zip and rent with $ and commas", () => {
    const r = parseSearch({ zip: "77007", rent: "$1,850" });
    expect(r.success && r.data).toEqual({ zip: "77007", rent: 1850, filters: {} });
  });

  it("rejects bad zip codes and out-of-range rent", () => {
    expect(parseSearch({ zip: "7700", rent: "1850" }).success).toBe(false);
    expect(parseSearch({ zip: "77007", rent: "50" }).success).toBe(false);
    expect(parseSearch({ zip: "77007", rent: "abc" }).success).toBe(false);
    expect(parseSearch({}).success).toBe(false);
  });
});

describe("ListingSchema", () => {
  const base = {
    id: "123",
    address: { street: "1 Main St", city: "Houston", state: "TX", zip: "77007" },
    price: 300000,
    beds: 3,
    baths: 2,
    sqft: 1500,
    lotSqft: null,
    homeType: "SINGLE_FAMILY",
    location: null,
    photos: ["https://example.com/a.jpg"],
    estimates: { value: null, rent: null, taxAssessed: null },
    daysOnMarket: null,
    broker: null,
    sourceUrl: null,
  };

  it("fills defaults for optional model fields", () => {
    const r = ListingSchema.parse(base);
    expect(r.model).toBeNull();
    expect(r.hoaMonthly).toBeNull();
    expect(r.yearBuilt).toBeNull();
  });

  it("rejects non-https photo and source URLs", () => {
    expect(ListingSchema.safeParse({ ...base, photos: ["javascript:alert(1)"] }).success).toBe(false);
    expect(ListingSchema.safeParse({ ...base, sourceUrl: "http://example.com" }).success).toBe(false);
  });
});

describe("filters in the URL", () => {
  it("round-trips through searchQuery and parseSearch", () => {
    const search = {
      zip: "77044",
      rent: 2100,
      filters: { minBeds: 4, minLotSqft: 5000, homeTypes: ["SINGLE_FAMILY" as const, "TOWNHOUSE" as const] },
    };
    const parsed = parseSearch(Object.fromEntries(new URLSearchParams(searchQuery(search))));
    expect(parsed.success && parsed.data).toEqual(search);
  });

  it("drops invalid filter values without failing the search", () => {
    const r = parseSearch({ zip: "77044", rent: "2100", beds: "99", type: "CASTLE", sqft: "1500" });
    expect(r.success && r.data.filters).toEqual({ minSqft: 1500 });
  });

  it("matchesFilters treats unknown sizes as not matching", () => {
    const home = { beds: null, baths: 2, sqft: 1400, lotSqft: null, homeType: "CONDO" };
    expect(matchesFilters(home, {})).toBe(true);
    expect(matchesFilters(home, { minBeds: 2 })).toBe(false);
    expect(matchesFilters(home, { homeTypes: ["SINGLE_FAMILY"] })).toBe(false);
  });
});
