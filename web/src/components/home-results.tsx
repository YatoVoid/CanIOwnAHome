"use client";

import type { ReactNode } from "react";
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
  const { zip, rent } = search;

  const heading =
    state.status === "loading" ? (
      <>Finding homes for around {money(rent)} a month…</>
    ) : state.status === "error" ? (
      <>We couldn&apos;t load homes right now</>
    ) : state.data.homes.length > 0 ? (
      <>
        {state.data.homes.length} homes you could own for around{" "}
        <span className="text-accent-ink">{money(rent)}</span> a month
      </>
    ) : (
      <>No homes matched {money(rent)} a month here yet</>
    );

  return (
    <>
      <section className="border-b border-line py-10">
        <p className="eyebrow">Zip {zip}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl" aria-live="polite">
          {heading}
        </h1>
        {form}
      </section>

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
              <AssumptionControls compact />
            </section>
            <section className="py-10">
              <HomeGrid homes={state.data.homes} query={query} zip={zip} rent={rent} />
            </section>
          </>
        ) : (
          <p className="max-w-xl py-10 text-ink-2">
            {hasFilters
              ? "Nothing nearby matched every requirement. Remove one of the filters above, or try a slightly higher monthly amount."
              : "Try a slightly higher monthly amount or a nearby zip code. Coverage is limited to the Houston area for now."}
          </p>
        ))}

      {state.status === "done" && (
        <BestDeals search={search} />
      )}

      {state.status === "done" && state.data.upstream === null && (
        <p className="text-sm text-ink-3">
          Results come from the demo model (affordability filter over listing data). The trained model is not connected.
        </p>
      )}
    </>
  );
}
