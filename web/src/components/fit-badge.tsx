import { rentFit } from "@/lib/finance";
import { signedMoney } from "@/lib/format";

const STYLES = {
  under: { cls: "bg-good-bg text-good", label: "Less than your rent" },
  near: { cls: "bg-near-bg text-near", label: "A bit more than rent" },
  stretch: { cls: "bg-over-bg text-over", label: "More than your rent" },
};

export function FitBadge({ monthly, rent }: { monthly: number; rent: number }) {
  const fit = rentFit(monthly, rent);
  const { cls, label } = STYLES[fit];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
      {label}
      <span className="font-normal tabular-nums">{signedMoney(monthly - rent)}/mo</span>
    </span>
  );
}
