import { readFileSync } from "node:fs";
import path from "node:path";
import type { Ours } from "@/lib/listing";

// Written by the ML notebook (houston-home/nb_src/06_export_site.py):
//   ours.json      { zpid: [fairPrice, percentBelowFair, "B"|"F"|"O"|"T", low, high] }
//   why.json       { features: string[], w: { zpid: [featureIndex, percentEffect, ...x3] } }
//   zip_flood.json { zip: { s: floodScore 0-1, c: claimCount } }
// If the files are missing the site simply shows no "ours" data.
const DIR = path.join(process.cwd(), "data", "ours");

type Scores = Record<string, [number, number, string, number?, number?]>;
type Why = { features?: string[]; w?: Record<string, number[]> };
type ZipFlood = Record<string, { s: number; c: number }>;

const cache = new Map<string, unknown>();
function load<T>(file: string): T {
  if (!cache.has(file)) {
    try {
      cache.set(file, JSON.parse(readFileSync(path.join(DIR, file), "utf8")));
    } catch {
      cache.set(file, {});
    }
  }
  return cache.get(file) as T;
}

const LABELS = { B: "bargain", F: "fair", O: "overpriced", T: "flood_trap" } as const;

export function floodLevel(score: number): "Low" | "Medium" | "High" {
  return score >= 0.75 ? "High" : score >= 0.4 ? "Medium" : "Low";
}

/** The three biggest drivers of this home's price, as % effect versus an average home. */
function whyFor(id: string) {
  const { features, w } = load<Why>("why.json");
  const r = w?.[id];
  if (!features || !r) return null;
  const out: { label: string; pct: number }[] = [];
  for (let i = 0; i + 1 < r.length; i += 2) if (features[r[i]]) out.push({ label: features[r[i]], pct: r[i + 1] });
  return out.length > 0 ? out : null;
}

export function oursFor(id: string, zip: string): Ours | null {
  const row = load<Scores>("ours.json")[id];
  if (!row) return null;
  const label = LABELS[row[2] as keyof typeof LABELS];
  if (!label) return null;
  const flood = load<ZipFlood>("zip_flood.json")[zip];
  return {
    fairPrice: row[0],
    gapPct: row[1],
    label,
    low: row[3] ?? null,
    high: row[4] ?? null,
    why: whyFor(id),
    floodScore: flood ? flood.s : null,
    floodLevel: flood ? floodLevel(flood.s) : null,
  };
}
