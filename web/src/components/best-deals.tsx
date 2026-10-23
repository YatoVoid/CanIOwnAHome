"use client";

import { HomeGrid } from "@/components/home-grid";
import { fetchDealScore } from "@/lib/api-client";
import { searchQuery, type Search } from "@/lib/listing";
import { useAsync } from "@/lib/use-async";

const SHOWN = 6;

type Weights = Record<string, string>;

const WEIGHT_LABELS: Record<string, string> = {
  value_vs_model: "price against the model's estimate",
  days_on_market: "days on market",
  rental_yield: "rental yield",
};

function weightsSentence(model: unknown) {
  const weights = (model as { scoring_weights?: Weights } | null)?.scoring_weights;
  if (!weights || typeof weights !== "object") return null;
  const parts = Object.entries(weights)
    .filter(([, v]) => typeof v === "string" && /^\d{1,3}%$/.test(v))
    .map(([k, v]) => `${WEIGHT_LABELS[k] ?? k.replace(/_/g, " ")} (${v})`);
  return parts.length > 0 ? `The score weighs ${parts.join(", ")}.` : null;
}

/** Top deals in the zip at any price, from the model's /deal-score endpoint. Hidden when it has nothing to add. */
export function BestDeals({ search }: { search: Search }) {
  const query = searchQuery(search);
  const { state } = useAsync(() => fetchDealScore(search), query);
  if (state.status !== "done") return null;

  const homes = state.data.homes.slice(0, SHOWN);
  if (homes.length === 0) return null;
  const weights = weightsSentence(state.data.model);

  return (
    <section className="border-t border-line py-12" aria-labelledby="deals-heading">
      <p className="eyebrow">Deal score</p>
      <h2 id="deals-heading" className="display mt-2 text-3xl sm:text-4xl">
        Best deals in {search.zip}, at any price
      </h2>
      <p className="mt-3 max-w-2xl text-ink-2">
        The model ranks every home in this zip by how good a deal it is. {weights} Some of these cost more than your rent;
        the monthly figure on each card shows by how much.
      </p>
      <div className="mt-8">
        <HomeGrid homes={homes} query={query} zip={search.zip} rent={search.rent} />
      </div>
    </section>
  );
}
