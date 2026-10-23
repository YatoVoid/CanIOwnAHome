import type { Metadata } from "next";
import { Suspense } from "react";
import { AssumptionControls } from "@/components/assumptions";
import { HomeGrid } from "@/components/home-grid";
import { SearchForm } from "@/components/search-form";
import { cachedRecommendations } from "@/lib/data";
import { money } from "@/lib/format";
import { parseSearch } from "@/lib/listing";
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

  const { zip, rent } = parsed.data;
  const homes = await cachedRecommendations({ zip, rent });

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
          <SearchForm zip={zip} rent={rent} size="bar" />
        </div>
      </section>

      {homes.length > 0 ? (
        <>
          <section className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
            <AssumptionControls compact />
          </section>
          <section className="py-10">
            <HomeGrid homes={homes} zip={zip} rent={rent} />
          </section>
        </>
      ) : (
        <p className="max-w-xl py-10 text-ink-2">
          Try a slightly higher monthly amount or a nearby zip code. Coverage is limited to the Houston area for now.
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
