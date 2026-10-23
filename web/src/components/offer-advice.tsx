"use client";

import { Section } from "@/components/section";
import { fetchOfferPrice } from "@/lib/api-client";
import { compactMoney, money } from "@/lib/format";
import { offerPlan, parseRoom } from "@/lib/offer";
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
  if (home.ours) {
    return (
      <OursOffer
        home={home}
        ours={home.ours}
        room={parseRoom(offer.negotiation_room)}
        timing={tidy(offer.reasoning?.timing)}
      />
    );
  }

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

/**
 * With our notebook score, offers are built from the same fair price shown above, so the page tells one story.
 * The hosted model still decides the negotiation room, from how long the home has been listed.
 */
function OursOffer({
  home,
  ours,
  room,
  timing,
}: {
  home: Listing;
  ours: NonNullable<Listing["ours"]>;
  room: number;
  timing: string | null;
}) {
  const plan = offerPlan(home.price, ours.fairPrice, room);
  const days = home.daysOnMarket;
  const range =
    ours.low != null && ours.high != null ? ` (our three models: ${compactMoney(ours.low)} to ${compactMoney(ours.high)})` : "";
  const cards =
    plan.startAt === plan.upTo
      ? [
          {
            label: "Offer about",
            amount: plan.upTo,
            reason: plan.underpriced
              ? "The asking price. It is already below our fair price, and the home was listed recently, so there is little room to go lower."
              : "Our fair price. The asking price is above it, and the home was listed recently.",
          },
        ]
      : [
          {
            label: "Start at",
            amount: plan.startAt,
            reason: `${plan.room}% below ${plan.underpriced ? "the asking price" : "our fair price"}${days != null ? `, since it has been listed for ${days} days` : ""}.`,
          },
          {
            label: "Go up to",
            amount: plan.upTo,
            reason: plan.underpriced
              ? "The asking price. It is already below our fair price, so there is no reason to pay more."
              : `Our fair price. The asking price is ${Math.round(((home.price - ours.fairPrice) / ours.fairPrice) * 100)}% above it.`,
          },
        ];

  return (
    <Section eyebrow="Offer" title="What to offer">
      <p className="max-w-3xl text-lg text-ink-2">
        Our fair price for this home is {money(ours.fairPrice)}
        {range}. The seller is asking {money(home.price)}.
      </p>

      <ul className={`mt-8 grid gap-4 ${cards.length > 1 ? "md:grid-cols-2" : "max-w-md"}`}>
        {cards.map((c) => (
          <li key={c.label} className="rounded-xl border border-line bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{c.label}</p>
            <p className="figure mt-2 text-3xl">{money(c.amount)}</p>
            <p className="mt-2 text-sm text-ink-2">{c.reason}</p>
          </li>
        ))}
      </ul>

      {ours.label === "flood_trap" && (
        <p className="mt-6 max-w-3xl rounded-lg bg-over-bg px-4 py-3 text-sm font-medium text-over">
          This home&apos;s zip has a high rate of flood-insurance claims, and the low price may reflect that. Get the
          home&apos;s flood history and a flood insurance quote before you make an offer.
        </p>
      )}
      {timing && <p className="mt-6 max-w-3xl text-ink-2">{timing}</p>}
      <p className="mt-3 text-xs text-ink-3">
        Based on our fair price, with the negotiation room from our hosted model. Not an appraisal: a buyer&apos;s agent
        can check recent sales before you make an offer.
      </p>
    </Section>
  );
}
