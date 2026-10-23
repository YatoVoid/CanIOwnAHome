import { readFileSync } from "node:fs";
import path from "node:path";

export type Metrics = { mae: number; mape: number; medape: number; r2: number };

export type FloodCard = {
  effect: { pct: number; lo: number; hi: number; n_zips: number };
  by_level: { level: string; homes: number; zips: number; median_price: number; median_ppsf: number; traps: number; bargains: number }[];
  top_zips: { zip: string; city: string; homes: number; claims: number; rate: number; median_price: number; median_ppsf: number }[];
  claims_total: number;
  zips: number;
};

// Written by the ML notebook (nb_src/06_export_site.py). Everything on the "Our models" and "Flood" pages comes from here.
export type ModelCard = {
  n_homes: number;
  n_with_zestimate: number;
  models: Record<string, Metrics>;
  same_homes: { n: number; ours: Metrics; zillow: Metrics };
  bands: { band: string; n: number; ours: Metrics; zillow: Metrics }[];
  scatter: [number, number, number][]; // [asking price, our estimate, Zillow Zestimate]
  importance: [string, number][]; // [feature, typical % swing in price]
  flood: FloodCard | null;
};

export function loadModelCard(): ModelCard | null {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "data", "ours", "model_card.json"), "utf8")) as ModelCard;
  } catch {
    return null;
  }
}

export const ENSEMBLE = "Ensemble (LGBM+XGB+Cat)";
export const BASELINE = "Ridge (baseline)";
