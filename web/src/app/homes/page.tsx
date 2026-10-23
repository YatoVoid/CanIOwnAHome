import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeResults } from "@/components/home-results";
import { SearchForm } from "@/components/search-form";
import Link from "next/link";
import { describeFilters, parseSearch, searchQuery, type Filters, type Search } from "@/lib/listing";
import { zipCovered } from "@/lib/listings-store";

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
    type Key = "income" | "rent" | "savings" | "debts" | "zip";
    const errors: Partial<Record<Key, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as Key;
      errors[key] ??= issue.message;
    }
    const raw = (k: string) => (typeof params[k] === "string" ? (params[k] as string).slice(0, 12) : "");
    return (
      <section className="py-16">
        <h1 className="display text-4xl">Check those numbers</h1>
        <div className="mt-8">
          <SearchForm
            values={{ income: raw("income"), rent: raw("rent"), savings: raw("savings"), debts: raw("debts"), zip: raw("zip") }}
            errors={errors}
          />
        </div>
      </section>
    );
  }

  const search = parsed.data;
  const keep = Object.fromEntries(new URLSearchParams(searchQuery(search)));
  for (const k of ["zip", "rent", "income", "savings", "debts"]) delete keep[k];
  const hasFilters = describeFilters(search.filters).length > 0;

  return (
    <HomeResults
      search={search}
      hasFilters={hasFilters}
      outOfArea={search.zip !== undefined && !zipCovered(search.zip)}
      form={
        <>
          <div className="mt-6">
            <SearchForm
              values={{ income: search.income, rent: search.rent, savings: search.savings, debts: search.debts, zip: search.zip }}
              size="bar"
              keep={keep}
            />
          </div>
          {hasFilters && <FilterChips search={search} />}
        </>
      }
    />
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
