import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanRating, dealScore, getListing, ModelError, offerPrice, predict, recommendHomes, rentToOwn } from "./client";
import { offerInput, predictInput } from "./predict-input";
import { mockRecommend } from "./mock";
import { costBreakdown, DEFAULT_ASSUMPTIONS, NEAR_RENT_FACTOR } from "@/lib/finance";

// 28276795 and 28291715 are real rows in data/listings/77044.json.
const result = (over: Record<string, unknown> = {}) => ({
  id: 28276795,
  address: "12343 Haroldson Forest Dr, Houston, TX 77044",
  zipcode: "77044",
  price: 259999,
  predicted_price: 569467,
  delta_pct: -54.3,
  tier: "GOOD_BUY",
  beds: 6.0,
  baths: 3.0,
  sqft_living: 3351.0,
  monthly_pi: 1517,
  monthly_total: 2167,
  photo: "https://photos.zillowstatic.com/fp/8dc0cedd4fc7df6e3830f7ef48f5c87d-p_e.jpg",
  detail_url: "https://www.zillow.com/homedetails/12343-Haroldson-Forest-Dr-Houston-TX-77044/28276795_zpid/",
  ...over,
});

describe("model API", () => {
  beforeEach(() => {
    process.env.MODEL_API_URL = "https://model.test/";
  });
  afterEach(() => {
    delete process.env.MODEL_API_URL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends zip and rent in the API's format and fills in listing data by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ results: [result()] }));
    vi.stubGlobal("fetch", fetchMock);

    const [home] = await recommendHomes({ zip: "77044", rent: 2200, filters: {} });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://model.test/rent-to-own");
    expect(JSON.parse(init.body)).toEqual({ zip: "77044", monthly_rent: 2200, down_payment: 0, n_results: 100 });
    expect(home.id).toBe("28276795");
    expect(home.location).not.toBeNull();
    expect(home.photos.length).toBeGreaterThan(1);
    expect(home.model).toMatchObject({ predictedPrice: 569467, tier: "GOOD_BUY" });
    expect(home.model?.reasons[0]).toContain("54% below");
  });

  it("keeps homes missing from the local data using the API's own fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ results: [result({ id: 999, address: "Plan 3028 Plan, Lakewood Pines Preserve" })] }),
      ),
    );
    const [home] = await recommendHomes({ zip: "77044", rent: 2200, filters: {} });
    expect(home.address.street).toBe("Plan 3028 Plan");
    expect(home.photos).toHaveLength(1);
  });

  it("skips malformed results and applies filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          results: [result(), { id: "bad id!", price: -1 }, result({ id: 28291715, price: 350000 })],
        }),
      ),
    );
    const homes = await recommendHomes({ zip: "77044", rent: 2200, filters: { minBeds: 6 } });
    expect(homes.every((h) => (h.beds ?? 0) >= 6)).toBe(true);
    expect(homes.map((h) => h.id)).not.toContain("bad id!");
  });

  it("returns an empty list when the API finds nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [], message: "No listings found." })));
    expect(await recommendHomes({ zip: "10001", rent: 2200, filters: {} })).toEqual([]);
  });

  it("retries once on a 5xx, then gives up", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(recommendHomes({ zip: "77044", rent: 2200, filters: {} })).rejects.toBeInstanceOf(ModelError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the model's raw response and the endpoint alongside the homes", async () => {
    const raw = { budget: 348064, results: [result()] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(raw)));
    const out = await rentToOwn({ zip: "77044", rent: 2200, filters: {} });
    expect(out.upstream).toBe("https://model.test/rent-to-own");
    expect(out.model).toEqual(raw);
    expect(out.homes).toHaveLength(1);
  });

  it("calls /predict without sending unknown fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ predicted_price: 318776, low_estimate: 207247, high_estimate: 430305 }));
    vi.stubGlobal("fetch", fetchMock);

    const home = await getListing("28276795");
    const input = predictInput({ ...home!, estimates: { ...home!.estimates, rent: null } })!;
    const out = await predict(input);

    expect(out).toEqual({
      upstream: "https://model.test/predict",
      prediction: { predicted_price: 318776, low_estimate: 207247, high_estimate: 430305 },
    });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ lat: expect.any(Number), lon: expect.any(Number), home_type: "SINGLE_FAMILY" });
    expect(sent).not.toHaveProperty("rent_zestimate");
  });

  it("throws when /predict returns something unexpected", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ price: "lots" })));
    const home = await getListing("28276795");
    await expect(predict(predictInput(home!)!)).rejects.toBeInstanceOf(ModelError);
  });

  it("returns null for unknown or malformed ids without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getListing("123")).toBeNull();
    expect(await getListing("../etc/passwd")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const deal = (over: Record<string, unknown> = {}) => ({
  address: "12343 Haroldson Forest Dr, Houston, TX 77044",
  price: 259999.0,
  predicted: 569466.8,
  value_gap_pct: 54.3,
  days_on_zillow: 245.0,
  deal_score: 100.0,
  rating: "Strong Buy \u2b50\u2b50\u2b50",
  beds: 6.0,
  baths: 3.0,
  sqft_living: 3351.0,
  zipcode: "77044",
  detail_url: "https://www.zillow.com/homedetails/12343-Haroldson-Forest-Dr-Houston-TX-77044/28276795_zpid/",
  ...over,
});

const offerResponse = (over: Record<string, unknown> = {}) => ({
  asking_price: 259999,
  model_estimate: 551316,
  confidence_range: "$439,787 \u2013 $662,845",
  value_verdict: "UNDERPRICED \u2014 model says this is a strong deal",
  gap_vs_model_pct: 52.8,
  days_on_market: 245.0,
  negotiation_room: "12%",
  offers: {
    competitive: { amount: 259999, reason: "Full ask" },
    fair: { amount: 551316, reason: "Model value" },
    negotiated: { amount: 485158, reason: "Model value minus 12%" },
  },
  reasoning: { value: "x", timing: "y" },
  ...over,
});

describe("deal-score and offer-price", () => {
  beforeEach(() => {
    process.env.MODEL_API_URL = "https://model.test";
  });
  afterEach(() => {
    delete process.env.MODEL_API_URL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends only the zip as the area and reads the id from detail_url", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ area: "Zip 77044", results: [deal()] }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await dealScore({ zip: "77044", rent: 2200, filters: {} });

    expect(fetchMock.mock.calls[0][0]).toBe("https://model.test/deal-score");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ area: "77044", n_results: 40 });
    expect(out.homes[0]).toMatchObject({ id: "28276795", price: 259999 });
    expect(out.homes[0].model).toMatchObject({ dealScore: 100, dealRating: "Strong buy", predictedPrice: 569466.8 });
    expect(out.homes[0].photos.length).toBeGreaterThan(1);
  });

  it("drops deal results when the endpoint answers for another area", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ area: "Galleria", results: [deal()] })));
    expect((await dealScore({ zip: "77044", rent: 2200, filters: {} })).homes).toEqual([]);
  });

  it("skips deal results without a zpid and applies filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ area: "Zip 77044", results: [deal({ detail_url: null }), deal({ beds: 2 }), deal()] }),
      ),
    );
    const out = await dealScore({ zip: "77044", rent: 2200, filters: { minBeds: 5 } });
    expect(out.homes.every((h) => h.id === "28276795" && (h.beds ?? 0) >= 5)).toBe(true);
  });

  it("sends exactly the documented offer fields and returns the parsed offer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(offerResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const home = await getListing("28276795");
    const input = offerInput(home!)!;
    const out = await offerPrice(input);

    expect(fetchMock.mock.calls[0][0]).toBe("https://model.test/offer-price");
    expect(Object.keys(JSON.parse(fetchMock.mock.calls[0][1].body)).sort()).toEqual(
      ["asking_price", "baths", "beds", "days_on_zillow", "home_type", "lat", "lon", "sqft_living"].sort(),
    );
    expect(out.offer?.offers.negotiated.amount).toBe(485158);
  });

  it("rejects an offer priced for a different asking price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(offerResponse({ asking_price: 350000 }))));
    const home = await getListing("28276795");
    await expect(offerPrice(offerInput(home!)!)).rejects.toBeInstanceOf(ModelError);
  });

  it("won't build an offer request when a required fact is missing", async () => {
    const home = await getListing("28276795");
    expect(offerInput({ ...home!, sqft: null })).toBeNull();
    expect(offerInput({ ...home!, location: null })).toBeNull();
  });

  it("cleans the star rating", () => {
    expect(cleanRating("Strong Buy \u2b50\u2b50\u2b50")).toBe("Strong buy");
    expect(cleanRating(null)).toBeNull();
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
