"use client";

import { Section } from "@/components/section";
import { fetchOfferPrice } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { Listing } from "@/lib/listing";
import { offerInput } from "@/lib/model/predict-input";
import { useAsync } from "@/lib/use-async";

/** The endpoint writes "A — B"; show it as "A: B". */
function tidy(text: string | null | undefined) {
  return text?.replace(/\s*—\s*/g, ": ").trim() || null;
}

const OFFERS = [
  { key: "competitive", label: "Competitive" },
  { key: "fair", label: "Fair value" },
  { key: "negotiated", label: "Negotiated" },
] as const;

export function OfferAdvice({ home }: { home: Listing }) {
  const input = offerInput(home);
  const { state } = useAsync(
    async () => (input ? (await fetchOfferPrice(input)).offer : null),
    input ? JSON.stringify(input) : home.id,
  );

  if (!input || state.status === "error") return null;
  if (state.status === "loading") {
    return (
      <Section eyebrow="Offer" title="What to offer">
        <div className="h-48 animate-pulse rounded-xl bg-sunk" aria-busy="true" aria-label="Working out an offer" />
      </Section>
    );
  }
  const offer = state.data;
  if (!offer) return null;

  const range = offer.confidence_range?.replace(/\s*[–-]\s*/, " to ");
  const verdict = tidy(offer.value_verdict);

  return (
    <Section eyebrow="Offer" title="What to offer">
      <div className="max-w-3xl space-y-2 text-lg text-ink-2">
        {verdict && <p className="font-medium text-ink">{verdict.charAt(0) + verdict.slice(1).toLowerCase()}</p>}
        <p>
          The model puts this home at {money(offer.model_estimate)}
          {range ? `, likely ${range}` : ""}. The seller is asking {money(offer.asking_price)}.
        </p>
      </div>

      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {OFFERS.map(({ key, label }) => {
          const o = offer.offers[key];
          const aboveAsk = o.amount > offer.asking_price;
          return (
            <li key={key} className="rounded-xl border border-line bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</p>
              <p className="figure mt-2 text-3xl">{money(o.amount)}</p>
              <p className="mt-2 text-sm text-ink-2">{tidy(o.reason)}</p>
              {aboveAsk && (
                <p className="mt-3 rounded bg-near-bg px-2 py-1 text-xs font-semibold text-near">
                  {money(o.amount - offer.asking_price)} above the asking price. You don&apos;t need to offer more than
                  the seller asks.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {(offer.reasoning?.timing || offer.negotiation_room) && (
        <p className="mt-6 max-w-3xl text-ink-2">
          {tidy(offer.reasoning?.timing)}
          {offer.negotiation_room ? ` Negotiation room the model sees: ${offer.negotiation_room}.` : ""}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Suggestions from the pricing model, not an appraisal. A buyer&apos;s agent can check recent sales before you make
        an offer.
      </p>
    </Section>
  );
}
