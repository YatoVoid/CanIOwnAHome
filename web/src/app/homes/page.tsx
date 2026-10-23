import type { Metadata } from "next";
import { Suspense } from "react";
import { AssumptionControls } from "@/components/assumptions";
import { HomeGrid } from "@/components/home-grid";
import { SearchForm } from "@/components/search-form";
import { cachedRecommendations } from "@/lib/data";
import { money } from "@/lib/format";
import Link from "next/link";
import { describeFilters, parseSearch, searchQuery, type Filters, type Search } from "@/lib/listing";
import { usingMockModel } from "@/lib/model/client";

export const metadata: Metadata = { title: "Homes you could own" };

export default function HomesPage({ searchParams }: PageProps<"/homes">) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/homes">["searchParams"] }) {
  const params = await searchParams;
  const parsed = parseSearch(params);

  if (!parsed.success) {
    const errors: { zip?: string; rent?: string } = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "zip" | "rent";
      errors[key] ??= issue.message;
    }
    const raw = (k: string) => (typeof params[k] === "string" ? (params[k] as string).slice(0, 10) : "");
    return (
      <section className="py-16">
        <h1 className="display text-4xl">Check those numbers</h1>
        <div className="mt-8">
          <SearchForm zip={raw("zip")} rent={raw("rent")} errors={errors} />
        </div>
      </section>
    );
  }

  const search = parsed.data;
  const { zip, rent, filters } = search;
  const homes = await cachedRecommendations(search);
  const query = searchQuery(search);
  const keep = Object.fromEntries(new URLSearchParams(query));
  delete keep.zip;
  delete keep.rent;
  const hasFilters = describeFilters(filters).length > 0;

  return (
    <>
      <section className="border-b border-line py-10">
        <p className="eyebrow">Zip {zip}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          {homes.length > 0 ? (
            <>
              {homes.length} homes you could own for around <span className="text-accent-ink">{money(rent)}</span> a
              month
            </>
          ) : (
            <>No homes matched {money(rent)} a month here yet</>
          )}
        </h1>
        <div className="mt-6">
          <SearchForm zip={zip} rent={rent} size="bar" keep={keep} />
        </div>
        {hasFilters && <FilterChips search={search} />}
      </section>

      {homes.length > 0 ? (
        <>
          <section className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
            <AssumptionControls compact />
          </section>
          <section className="py-10">
            <HomeGrid homes={homes} query={query} zip={zip} rent={rent} />
          </section>
        </>
      ) : (
        <p className="max-w-xl py-10 text-ink-2">
          {hasFilters
            ? "Nothing nearby matched every requirement. Remove one of the filters above, or try a slightly higher monthly amount."
            : "Try a slightly higher monthly amount or a nearby zip code. Coverage is limited to the Houston area for now."}
        </p>
      )}

      {usingMockModel() && (
        <p className="text-sm text-ink-3">
          Results come from the demo model (affordability filter over listing data). The trained model is not connected
          yet.
        </p>
      )}
    </>
  );
}

const FILTER_KEYS: (keyof Filters)[] = ["minBeds", "minBaths", "minSqft", "minLotSqft", "homeTypes"];

function FilterChips({ search }: { search: Search }) {
  const chips = FILTER_KEYS.filter((k) => search.filters[k] !== undefined).map((key) => {
    const without = { ...search, filters: { ...search.filters, [key]: undefined } };
    return { key, label: describeFilters({ [key]: search.filters[key] })[0], href: `/homes?${searchQuery(without)}` };
  });
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-3">Filtered to</span>
      {chips.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 hover:border-ink-3"
          aria-label={`Remove filter: ${c.label}`}
        >
          {c.label}
          <span aria-hidden className="text-ink-3">
            ×
          </span>
        </Link>
      ))}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="animate-pulse py-10" aria-busy="true" aria-label="Loading homes">
      <div className="h-4 w-24 rounded bg-sunk" />
      <div className="mt-4 h-12 w-2/3 rounded bg-sunk" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[4/3] rounded-lg bg-sunk" />
        ))}
      </div>
    </div>
  );
}
