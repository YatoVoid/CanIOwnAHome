import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getListing, ModelError, recommendHomes } from "./client";
import { mockListing, mockRecommend } from "./mock";
import { costBreakdown, DEFAULT_ASSUMPTIONS, NEAR_RENT_FACTOR } from "@/lib/finance";

const listing = {
  id: "abc",
  address: { street: "1 Main St", city: "Houston", state: "TX", zip: "77007" },
  price: 300000,
  beds: 3,
  baths: 2,
  sqft: 1500,
  lotSqft: null,
  homeType: "SINGLE_FAMILY",
  location: null,
  photos: [],
  estimates: { value: null, rent: null, taxAssessed: null },
  daysOnMarket: null,
  broker: null,
  sourceUrl: null,
};

describe("model client against a real API", () => {
  beforeEach(() => {
    process.env.MODEL_API_URL = "https://model.test/";
    process.env.MODEL_API_KEY = "secret";
  });
  afterEach(() => {
    delete process.env.MODEL_API_URL;
    delete process.env.MODEL_API_KEY;
    vi.unstubAllGlobals();
  });

  it("posts zip and rent and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ homes: [listing] }));
    vi.stubGlobal("fetch", fetchMock);

    const homes = await recommendHomes({ zip: "77007", rent: 2000, filters: {} });

    expect(homes).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://model.test/recommend");
    expect(JSON.parse(init.body)).toEqual({ zip: "77007", monthlyRent: 2000, filters: {} });
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret");
  });

  it("drops homes the model returned that break the filters", async () => {
    const small = { ...listing, id: "small", beds: 2 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ homes: [listing, small] })));
    const homes = await recommendHomes({ zip: "77007", rent: 2000, filters: { minBeds: 3 } });
    expect(homes.map((h) => h.id)).toEqual(["abc"]);
  });

  it("throws on an invalid payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ homes: [{ id: "x" }] })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recommendHomes({ zip: "77007", rent: 2000, filters: {} })).rejects.toBeInstanceOf(ModelError);
  });

  it("retries once on a 5xx, then gives up", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(recommendHomes({ zip: "77007", rent: 2000, filters: {} })).rejects.toThrow("503");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null for an unknown listing and skips bad ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getListing("missing")).toBeNull();
    expect(await getListing("../etc/passwd")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("mock model", () => {
  it("returns homes in or near the zip that fit the rent ceiling", () => {
    const rent = 2200;
    const homes = mockRecommend({ zip: "77044", rent, filters: {} });
    expect(homes.length).toBeGreaterThan(0);
    for (const h of homes) {
      expect(costBreakdown(h.price, null, DEFAULT_ASSUMPTIONS).total).toBeLessThanOrEqual(rent * NEAR_RENT_FACTOR);
    }
    expect(mockListing(homes[0].id)?.id).toBe(homes[0].id);
  });

  it("applies bedroom and home type filters", () => {
    const homes = mockRecommend({ zip: "77044", rent: 2600, filters: { minBeds: 4, homeTypes: ["SINGLE_FAMILY"] } });
    expect(homes.length).toBeGreaterThan(0);
    for (const h of homes) {
      expect(h.beds).toBeGreaterThanOrEqual(4);
      expect(h.homeType).toBe("SINGLE_FAMILY");
    }
  });

  it("returns nothing for a zip outside the dataset", () => {
    expect(mockRecommend({ zip: "10001", rent: 2000, filters: {} })).toEqual([]);
  });
});
