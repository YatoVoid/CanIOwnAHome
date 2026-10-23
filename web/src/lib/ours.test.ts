import { describe, expect, it } from "vitest";
import { rowsInZip } from "./listings-store";
import { loadModelCard } from "./model-card";
import { usablePrices } from "./model/ours-search";
import { oursFor } from "./ours";

describe("exported model scores", () => {
  const scored = rowsInZip("77033")
    .map((r) => ({ r, ours: oursFor(r.id, r.z) }))
    .filter((x) => x.ours);

  it("gives most homes a fair price with a range that brackets it", () => {
    expect(scored.length).toBeGreaterThan(20);
    for (const { ours } of scored) {
      expect(ours!.low).not.toBeNull();
      expect(ours!.high).not.toBeNull();
      expect(ours!.low!).toBeLessThanOrEqual(ours!.fairPrice + 1);
      expect(ours!.high!).toBeGreaterThanOrEqual(ours!.fairPrice - 1);
    }
  });

  it("explains each price with three named drivers", () => {
    for (const { ours } of scored.slice(0, 25)) {
      expect(ours!.why).toHaveLength(3);
      for (const w of ours!.why!) {
        expect(w.label.length).toBeGreaterThan(2);
        expect(Number.isFinite(w.pct)).toBe(true);
      }
    }
  });

  it("carries a flood level for the zip", () => {
    expect(["Low", "Medium", "High"]).toContain(scored[0].ours!.floodLevel);
  });

  it("lists thousands of recommendable prices for the What if? page", () => {
    expect(usablePrices().length).toBeGreaterThan(10_000);
  });
});

describe("model card", () => {
  const card = loadModelCard();

  it("has the Zestimate comparison, price bands and a sample for the charts", () => {
    expect(card).not.toBeNull();
    expect(card!.same_homes.n).toBeGreaterThan(10_000);
    expect(card!.same_homes.zillow.mae).toBeGreaterThan(0);
    expect(card!.bands.length).toBe(5);
    expect(card!.scatter.length).toBeGreaterThan(500);
    expect(card!.importance[0][0]).toBeTruthy();
  });

  it("has the flood analysis with a plausible range around its estimate", () => {
    const e = card!.flood!.effect;
    expect(e.lo).toBeLessThanOrEqual(e.pct);
    expect(e.hi).toBeGreaterThanOrEqual(e.pct);
    expect(card!.flood!.by_level.map((l) => l.level).sort()).toEqual(["High", "Low", "Medium"]);
  });
});
