const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const money = (n: number) => usd.format(Math.round(n));
export const count = (n: number) => int.format(n);

export function compactMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return money(n);
}

export function signedMoney(n: number) {
  const rounded = Math.round(n);
  if (rounded === 0) return "$0";
  return `${rounded > 0 ? "+" : "−"}${usd.format(Math.abs(rounded))}`;
}

export function bathsLabel(baths: number) {
  return Number.isInteger(baths) ? String(baths) : baths.toFixed(1);
}

const ZILLOW_PHOTO = /^(https:\/\/photos\.zillowstatic\.com\/fp\/[0-9a-f]{32})-[A-Za-z0-9_]+\.(jpg|webp)$/;

/** Zillow serves each photo at several sizes from the same hash; other hosts pass through. */
export function photoAt(url: string, size: "card" | "full") {
  const m = ZILLOW_PHOTO.exec(url);
  if (!m) return url;
  return size === "card" ? `${m[1]}-cc_ft_768.jpg` : `${m[1]}-uncropped_scaled_within_1536_1152.jpg`;
}
