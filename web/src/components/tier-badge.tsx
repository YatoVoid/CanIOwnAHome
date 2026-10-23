import { TIER_LABELS, type Tier } from "@/lib/listing";

const STYLES: Record<Tier, string> = {
  GOOD_BUY: "border-good/40 text-good",
  NEGOTIATE: "border-near/40 text-near",
  OVERPRICED: "border-over/40 text-over",
};

export function TierBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border bg-card/95 px-2 py-0.5 text-xs font-semibold ${STYLES[tier]} ${className}`}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
