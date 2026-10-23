import { describe, expect, it } from "vitest";
import { floodCounts, floodPercentile, hideHighFlood } from "./flood";
import type { Ours } from "./listing";

const home = (floodLevel: Ours["floodLevel"], label: Ours["label"] = "fair", floodScore = 0.5) => ({
  ours: { fairPrice: 200_000, gapPct: 0, label, floodScore, floodLevel } as Ours,
});

describe("flood helpers", () => {
  const homes = [home("Low"), home("Medium"), home("High"), home("High", "flood_trap"), { ours: null }];

  it("counts homes by flood level and flood traps", () => {
    expect(floodCounts(homes)).toEqual({ High: 2, Medium: 1, Low: 1, unknown: 1, traps: 1 });
  });

  it("hides only homes in high flood-claim zips", () => {
    const shown = hideHighFlood(homes);
    expect(shown).toHaveLength(3);
    expect(shown.every((h) => h.ours?.floodLevel !== "High")).toBe(true);
  });

  it("turns the score into a percentage", () => {
    expect(floodPercentile(0.456)).toBe(46);
    expect(floodPercentile(null)).toBeNull();
  });
});
