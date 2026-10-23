"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Section } from "@/components/section";
import { TierBadge } from "@/components/tier-badge";
import { ValueScale } from "@/components/value-scale";
import { fetchDescription, fetchPredict, fetchRentToOwn, findInResults } from "@/lib/api-client";
import { bathsLabel, compactMoney, count } from "@/lib/format";
import { homeTypeLabel, searchQuery, type Listing, type Search } from "@/lib/listing";
import { predictInput } from "@/lib/model/predict-input";
import { useAsync } from "@/lib/use-async";

export function HomeNav({ id, search }: { id: string; search: Search }) {
  const query = searchQuery(search);
  const { state } = useAsync(() => fetchRentToOwn(search), query);
  const homes = state.status === "done" ? state.data.homes : [];
  const i = homes.findIndex((h) => h.id === id);
  const q = `?${query}`;
  const prev = i > 0 ? homes[i - 1] : null;
  const next = i >= 0 && i < homes.length - 1 ? homes[i + 1] : null;

  return (
    <nav aria-label="Browse homes" className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
        <Link href={`/homes${q}`} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> All homes
        </Link>
        {i >= 0 && (
          <div className="flex items-center gap-4">
            {prev ? (
              <Link href={`/homes/${prev.id}${q}`} className="inline-flex items-center gap-1 hover:underline">
                <ArrowLeft className="size-4" aria-hidden /> Previous
              </Link>
            ) : (
              <span className="text-ink-3">Previous</span>
            )}
            <span className="tabular-nums text-ink-3">
              {i + 1} of {homes.length}
            </span>
            {next ? (
              <Link href={`/homes/${next.id}${q}`} className="inline-flex items-center gap-1 hover:underline">
                Next <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className="text-ink-3">Next</span>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

/** The verdict and reasons come from the rent-to-own call, so they only exist when the visitor came from a search. */
export function ModelVerdict({ home, search }: { home: Listing; search: Search | null }) {
  const { state } = useAsync(
    async () => (search ? findInResults(await fetchRentToOwn(search), home.id)?.model : home.model) ?? null,
    `${home.id}?${search ? searchQuery(search) : ""}`,
  );
  if (state.status !== "done" || !state.data) return null;
  const model = state.data;

  return (
    <>
      {model.tier && <TierBadge tier={model.tier} />}
      {model.reasons.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Why it was picked</p>
          <ul className="mt-2 space-y-1.5 text-ink-2">
            {model.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

type Mark = { key: string; label: string; value: number; note: string };

export function PriceCheck({ home, search }: { home: Listing; search: Search | null }) {
  const { state } = useAsync(async () => {
    const input = predictInput(home);
    const [predicted, context] = await Promise.allSettled([
      input ? fetchPredict(input) : Promise.resolve(null),
      search ? fetchRentToOwn(search) : Promise.resolve(null),
    ]);
    const prediction = predicted.status === "fulfilled" ? predicted.value?.prediction : null;
    const match = context.status === "fulfilled" && context.value ? findInResults(context.value, home.id) : undefined;
    return {
      // Prefer the rent-to-own figure when the visitor came from a search, so this matches "Why it was picked".
      predictedPrice: match?.model?.predictedPrice ?? prediction?.predicted_price ?? home.model?.predictedPrice ?? null,
      low: prediction?.low_estimate ?? null,
      high: prediction?.high_estimate ?? null,
    };
  }, `${home.id}?${search ? searchQuery(search) : ""}`);

  if (state.status === "loading") {
    return (
      <Section eyebrow="Value" title="Is the price fair?">
        <div className="h-64 animate-pulse rounded-xl bg-sunk" aria-busy="true" aria-label="Checking the price" />
      </Section>
    );
  }

  const model = state.status === "done" ? state.data : null;
  const marks = [
    model?.predictedPrice != null && {
      key: "model",
      label: "Model estimate",
      value: model.predictedPrice,
      note:
        model.low != null && model.high != null
          ? `Our pricing model, likely ${compactMoney(model.low)} to ${compactMoney(model.high)}`
          : "Our pricing model",
    },
    home.estimates.value != null &&
      home.estimates.value !== model?.predictedPrice && {
        key: "value",
        label: "Market estimate",
        value: home.estimates.value,
        note: "Automated valuation",
      },
    home.estimates.taxAssessed != null && {
      key: "tax",
      label: "Tax appraisal",
      value: home.estimates.taxAssessed,
      note: "County appraised value",
    },
  ].filter(Boolean) as Mark[];

  if (marks.length === 0) return null;

  const ref = marks[0].value;
  const gap = (home.price - ref) / ref;
  const verdict =
    Math.abs(gap) < 0.03
      ? "The asking price is in line with the estimates."
      : gap > 0
        ? `The asking price is ${Math.round(gap * 100)}% above the ${marks[0].label.toLowerCase()}. There may be room to negotiate.`
        : `The asking price is ${Math.round(-gap * 100)}% below the ${marks[0].label.toLowerCase()}.`;

  return (
    <Section eyebrow="Value" title="Is the price fair?">
      <p className="mb-6 max-w-2xl text-lg text-ink-2">{verdict}</p>
      <ValueScale price={home.price} marks={marks} />
    </Section>
  );
}

export function HomeDescription({ home }: { home: Listing }) {
  const { state } = useAsync(() => fetchDescription(home.id), home.id);

  if (state.status === "loading") {
    return (
      <div className="max-w-3xl animate-pulse space-y-3" aria-busy="true" aria-label="Writing description">
        <div className="h-4 rounded bg-sunk" />
        <div className="h-4 rounded bg-sunk" />
        <div className="h-4 w-4/5 rounded bg-sunk" />
      </div>
    );
  }

  const text = state.status === "done" ? state.data.text : null;
  if (!text) return <FallbackDescription home={home} />;

  return (
    <div className="max-w-3xl">
      <div className="space-y-4 text-lg leading-relaxed text-ink-2">
        {text
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
      </div>
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-3">
        <Sparkles className="size-3.5" aria-hidden />
        Description generated by Google Gemini from the listing facts above. It can be wrong, so check details with the
        seller.
      </p>
    </div>
  );
}

function FallbackDescription({ home }: { home: Listing }) {
  const parts = [
    `${homeTypeLabel(home.homeType)} home in ${home.address.city}, ${home.address.zip}`,
    home.beds != null && home.baths != null && `with ${home.beds} bedrooms and ${bathsLabel(home.baths)} bathrooms`,
    home.sqft != null && `across ${count(home.sqft)} square feet`,
  ].filter(Boolean);
  return <p className="max-w-3xl text-lg leading-relaxed text-ink-2">{parts.join(" ")}.</p>;
}
