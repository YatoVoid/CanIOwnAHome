import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getListing, ModelError, recommendHomes } from "./client";
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

  it("adds the predicted price range to a single listing, without sending unknown fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ predicted_price: 318776, low_estimate: 207247, high_estimate: 430305 }));
    vi.stubGlobal("fetch", fetchMock);

    const home = await getListing("28276795");

    expect(home?.model).toMatchObject({ predictedPrice: 318776, low: 207247, high: 430305 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://model.test/predict");
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ lat: expect.any(Number), lon: expect.any(Number), home_type: "SINGLE_FAMILY" });
    expect(Object.values(sent)).not.toContain(null);
  });

  it("still shows a listing when the predict API fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const home = await getListing("28276795");
    expect(home?.id).toBe("28276795");
    expect(home?.model).toBeNull();
  });

  it("returns null for unknown or malformed ids without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getListing("123")).toBeNull();
    expect(await getListing("../etc/passwd")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
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
