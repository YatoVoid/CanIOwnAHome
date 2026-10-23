import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { CostBreakdown } from "@/components/cost-breakdown";
import { Gallery } from "@/components/gallery";
import { ValueScale } from "@/components/value-scale";
import { cachedListing, cachedRecommendations } from "@/lib/data";
import { describeHome, descriptionFacts, geminiConfigured } from "@/lib/describe";
import { bathsLabel, count, money, photoAt } from "@/lib/format";
import { homeTypeLabel, parseSearch, type Listing, type Search } from "@/lib/listing";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Home details" };

const allowDescription = createRateLimiter({ limit: 30, windowMs: 60_000 });

export default function HomePage({ params, searchParams }: PageProps<"/homes/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <HomeDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/homes/[id]">["params"];
  searchParams: PageProps<"/homes/[id]">["searchParams"];
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const home = await cachedListing(id);
  if (!home) notFound();

  const parsed = parseSearch(sp);
  const search = parsed.success ? parsed.data : null;
  const rent = search?.rent ?? home.estimates.rent ?? null;
  const address = `${home.address.street}, ${home.address.city}, ${home.address.state} ${home.address.zip}`;
  const facts = [
    home.beds != null && `${home.beds} bed`,
    home.baths != null && `${bathsLabel(home.baths)} bath`,
    home.sqft != null && `${count(home.sqft)} sqft`,
    home.yearBuilt != null && `Built ${home.yearBuilt}`,
    homeTypeLabel(home.homeType),
  ].filter(Boolean) as string[];

  return (
    <article>
      {search && <HomeNav id={home.id} search={search} />}

      <header className="relative isolate overflow-hidden bg-navy text-on-navy">
        {home.photos[0] && (
          <Image
            src={photoAt(home.photos[0], "full")}
            alt=""
            fill
            unoptimized
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1c2a42] via-[#1c2a42]/75 to-[#1c2a42]/10" />
        <div className="mx-auto flex min-h-[26rem] max-w-6xl flex-col justify-end px-4 pb-10 pt-32 sm:min-h-[32rem] sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            {home.address.city} · {home.address.zip}
          </p>
          <h1 className="display mt-3 text-5xl text-white sm:text-7xl">{home.address.street}</h1>
          <p className="mt-4 text-lg text-white/85">{facts.join(" · ")}</p>
          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-3 border-t border-accent/70 pt-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/70">Asking price</p>
              <p className="figure text-3xl text-white">{money(home.price)}</p>
            </div>
            {home.estimates.value != null && (
              <div>
                <p className="text-xs uppercase tracking-wider text-white/70">Estimated value</p>
                <p className="figure text-3xl text-white">{money(home.estimates.value)}</p>
              </div>
            )}
            {rent != null && (
              <div>
                <p className="text-xs uppercase tracking-wider text-white/70">
                  {search ? "Your rent" : "Typical rent here"}
                </p>
                <p className="figure text-3xl text-white">{money(rent)}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-20 px-4 py-14 sm:px-6">
        <Section eyebrow="At a glance" title="The home">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Gallery photos={home.photos} address={address} />
            <div className="space-y-6">
              <dl className="divide-y divide-line rounded-xl border border-line bg-card px-5">
                <Fact label="Type" value={homeTypeLabel(home.homeType)} />
                {home.beds != null && <Fact label="Bedrooms" value={String(home.beds)} />}
                {home.baths != null && <Fact label="Bathrooms" value={bathsLabel(home.baths)} />}
                {home.sqft != null && <Fact label="Living area" value={`${count(home.sqft)} sqft`} />}
                {home.lotSqft != null && <Fact label="Lot" value={`${count(home.lotSqft)} sqft`} />}
                {home.sqft != null && <Fact label="Price per sqft" value={money(home.price / home.sqft)} />}
                {home.daysOnMarket != null && <Fact label="Days listed" value={String(home.daysOnMarket)} />}
                <Fact label="HOA" value={home.hoaMonthly != null ? `${money(home.hoaMonthly)}/mo` : "Not listed"} />
              </dl>
              {home.model && home.model.reasons.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Why it was picked</p>
                  <ul className="mt-2 space-y-1.5 text-ink-2">
                    {home.model.reasons.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section eyebrow="About" title="What it's like">
          <Suspense fallback={<DescriptionSkeleton />}>
            <Description home={home} />
          </Suspense>
        </Section>

        {rent != null && (
          <Section eyebrow="Monthly cost" title="What owning it would cost you">
            <CostBreakdown
              price={home.price}
              hoaMonthly={home.hoaMonthly}
              rent={rent}
              rentLabel={search ? "Your rent" : "Typical rent"}
            />
          </Section>
        )}

        <PriceCheck home={home} />

        {home.location && (
          <Section eyebrow="Location" title="Where it is">
            <iframe
              title={`Map of ${address}`}
              className="h-80 w-full rounded-xl border border-line"
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin"
              src={osmEmbed(home.location.lat, home.location.lng)}
            />
            <a
              href={`https://www.openstreetmap.org/?mlat=${home.location.lat}&mlon=${home.location.lng}#map=16/${home.location.lat}/${home.location.lng}`}
              className="mt-2 inline-block text-sm text-ink-2 underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open larger map
            </a>
          </Section>
        )}

        <footer className="border-t border-line pt-6 text-sm text-ink-3">
          {home.broker && <p>Listed by {home.broker}.</p>}
          {home.sourceUrl && (
            <a
              href={home.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-ink-2 underline underline-offset-4"
            >
              View the original listing <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </footer>
      </div>
    </article>
  );
}

async function HomeNav({ id, search }: { id: string; search: Search }) {
  const homes = await cachedRecommendations(search).catch(() => [] as Listing[]);
  const i = homes.findIndex((h) => h.id === id);
  const q = `?zip=${search.zip}&rent=${search.rent}`;
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

async function Description({ home }: { home: Listing }) {
  if (!geminiConfigured()) return <FallbackDescription home={home} />;

  await connection();
  const ip = clientIp(await headers());
  if (!allowDescription(`${ip}`)) return <FallbackDescription home={home} />;

  let text: string;
  try {
    text = await describeHome(descriptionFacts(home));
  } catch (err) {
    console.error("description failed", home.id, err instanceof Error ? err.message : err);
    return <FallbackDescription home={home} />;
  }

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
        Description generated by Google Gemini from the listing facts above. It can be wrong, so check details with the seller.
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

function PriceCheck({ home }: { home: Listing }) {
  const marks = [
    home.model?.predictedPrice != null && {
      key: "model",
      label: "Model estimate",
      value: home.model.predictedPrice,
      note: "Our pricing model",
    },
    home.estimates.value != null &&
      home.estimates.value !== home.model?.predictedPrice && {
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
  ].filter(Boolean) as { key: string; label: string; value: number; note: string }[];

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

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mb-8 mt-2 text-4xl sm:text-5xl">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function osmEmbed(lat: number, lng: number) {
  const d = 0.008;
  const bbox = [lng - d, lat - d * 0.6, lng + d, lat + d * 0.6].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function DescriptionSkeleton() {
  return (
    <div className="max-w-3xl animate-pulse space-y-3" aria-busy="true" aria-label="Writing description">
      <div className="h-4 rounded bg-sunk" />
      <div className="h-4 rounded bg-sunk" />
      <div className="h-4 w-4/5 rounded bg-sunk" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading home">
      <div className="h-[26rem] bg-sunk sm:h-[32rem]" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-14 sm:px-6">
        <div className="h-4 w-24 rounded bg-sunk" />
        <div className="h-10 w-1/2 rounded bg-sunk" />
      </div>
    </div>
  );
}
