"use client";

import { useState, type ReactNode } from "react";
import { FloodSummary } from "@/components/flood-summary";
import { hideHighFlood } from "@/lib/flood";
import { AffordabilityCard } from "@/components/affordability-card";
import { AssumptionControls } from "@/components/assumptions";
import { BestDeals } from "@/components/best-deals";
import { HomeGrid } from "@/components/home-grid";
import { fetchRentToOwn } from "@/lib/api-client";
import { money } from "@/lib/format";
import { searchQuery, type Search } from "@/lib/listing";
import { useAsync } from "@/lib/use-async";

export function HomeResults({ search, hasFilters, form }: { search: Search; hasFilters: boolean; form: ReactNode }) {
  const query = searchQuery(search);
  const { state, retry } = useAsync(() => fetchRentToOwn(search), query);
  const { zip, rent, savings } = search;
  const withIncome = search.income !== undefined;
  const [hideHigh, setHideHigh] = useState(false);

  const heading =
    state.status === "loading" ? (
      <>{withIncome ? "Finding homes you can afford…" : <>Finding homes for around {money(rent)} a month…</>}</>
    ) : state.status === "error" ? (
      <>We couldn&apos;t load homes right now</>
    ) : state.data.homes.length > 0 ? (
      withIncome ? (
        <>
          {state.data.homes.length} homes you can afford, <span className="text-accent-ink">best value first</span>
        </>
      ) : (
        <>
          {state.data.homes.length} homes you could own for around <span className="text-accent-ink">{money(rent)}</span> a month
        </>
      )
    ) : (
      <>
        No homes matched {withIncome ? "your budget" : `${money(rent)} a month`} {zip ? "here" : "in Houston"} yet
      </>
    );

  return (
    <>
      <section className="border-b border-line py-10">
        <p className="eyebrow">{zip ? `Zip ${zip}` : "All of Houston"}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl" aria-live="polite">
          {heading}
        </h1>
        {form}
      </section>

      <AffordabilityCard search={search} />

      {state.status === "loading" && (
        <div className="mt-10 grid animate-pulse gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[4/3] rounded-lg bg-sunk" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="max-w-xl py-10">
          <p className="text-ink-2">{state.error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-md bg-navy px-5 py-2.5 font-semibold text-on-navy"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "done" &&
        (state.data.homes.length > 0 ? (
          <>
            <section className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
              <AssumptionControls compact savings={savings} />
            </section>
            <FloodSummary homes={state.data.homes} hideHigh={hideHigh} onToggle={setHideHigh} />
            <section className="py-10">
              <p className="eyebrow mb-6">Step 2 and 3 · Homes in your budget, priced by our model</p>
              {hideHigh && hideHighFlood(state.data.homes).length === 0 ? (
                <p className="max-w-xl text-ink-2">Every home in this search is in a high flood-claim zip. Untick the box above to see them.</p>
              ) : (
                <HomeGrid
                  homes={hideHigh ? hideHighFlood(state.data.homes) : state.data.homes}
                  query={query}
                  zip={zip}
                  rent={rent}
                  savings={savings}
                />
              )}
            </section>
          </>
        ) : (
          <p className="max-w-xl py-10 text-ink-2">
            {hasFilters
              ? "Nothing matched every requirement. Remove one of the filters above, or try a slightly higher monthly budget."
              : zip
                ? "Try a slightly higher monthly budget, a nearby zip code, or leave the zip blank to search all of Houston."
                : "Try a slightly higher monthly budget. Coverage is limited to the Houston area for now."}
          </p>
        ))}

      {state.status === "done" && (
        <BestDeals search={search} />
      )}

      {state.status === "done" && (withIncome || !zip) && (
        <p className="text-sm text-ink-3">
          Homes are ranked with our trained price model: only homes whose full monthly cost fits your budget, with the best
          value first. &quot;Priced below fair value&quot; means all three of our models put the asking price at least 10% below
          what similar homes list for; it cannot see condition. Flood warnings come from flood-insurance claims in the zip
          code.{!zip && " With no zip code, at most three homes per zip are shown so one neighborhood does not crowd out the rest."}
        </p>
      )}

      {state.status === "done" && !withIncome && zip && state.data.upstream === null && (
        <p className="text-sm text-ink-3">
          Results come from the demo model (affordability filter over listing data). The trained model is not connected.
        </p>
      )}
    </>
  );
}
