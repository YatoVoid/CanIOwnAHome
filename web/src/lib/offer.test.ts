import { describe, expect, it } from "vitest";
import { offerPlan, parseRoom } from "./offer";

describe("offerPlan", () => {
  it("never goes above the asking price when the home is underpriced", () => {
    const p = offerPlan(160_000, 233_922, 12);
    expect(p.upTo).toBe(160_000);
    expect(p.startAt).toBe(140_800);
    expect(p.underpriced).toBe(true);
  });

  it("caps at our fair price when the asking price is above it", () => {
    const p = offerPlan(300_000, 250_000, 4);
    expect(p.upTo).toBe(250_000);
    expect(p.startAt).toBe(240_000);
    expect(p.underpriced).toBe(false);
  });

  it("clamps silly negotiation room", () => {
    expect(offerPlan(200_000, 200_000, -5).startAt).toBe(200_000);
    expect(offerPlan(200_000, 200_000, 90).room).toBe(30);
  });
});

describe("parseRoom", () => {
  it("reads the percentage the endpoint returns", () => {
    expect(parseRoom("12%")).toBe(12);
    expect(parseRoom("0%")).toBe(0);
    expect(parseRoom(null)).toBe(0);
    expect(parseRoom("lots")).toBe(0);
  });
});
