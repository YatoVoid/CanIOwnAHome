import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { CostBreakdown } from "@/components/cost-breakdown";
import { Gallery } from "@/components/gallery";
import { HomeDescription, HomeNav, ModelVerdict, PriceCheck } from "@/components/home-model";
import { OfferAdvice } from "@/components/offer-advice";
import { OursCheck } from "@/components/ours-badge";
import { Section } from "@/components/section";
import { cachedListing } from "@/lib/data";
import { bathsLabel, count, money, photoAt } from "@/lib/format";
import { homeTypeLabel, parseSearch } from "@/lib/listing";

export const metadata: Metadata = { title: "Home details" };

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
                  {search ? (search.income !== undefined ? "Your rent" : "Your budget") : "Typical rent here"}
                </p>
                <p className="figure text-3xl text-white">{money(rent)}</p>
              </div>
            )}
            {home.ours?.floodLevel && (
              <div>
                <p className="text-xs uppercase tracking-wider text-white/70">Flood risk (zip)</p>
                <p className="figure text-3xl text-white">{home.ours.floodLevel}</p>
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
              <ModelVerdict home={home} search={search} />
            </div>
          </div>
        </Section>

        {home.ours && (
          <Section eyebrow="Fair price and flooding" title="Is it cheap, or cheap for a reason?">
            <OursCheck ours={home.ours} price={home.price} />
          </Section>
        )}

        <Section eyebrow="About" title="What it's like">
          <HomeDescription home={home} />
        </Section>

        {rent != null && (
          <Section eyebrow="Monthly cost" title="What owning it would cost you">
            <CostBreakdown
              price={home.price}
              hoaMonthly={home.hoaMonthly}
              rent={rent}
              rentLabel={search ? (search.income !== undefined ? "Your rent" : "Your budget") : "Typical rent"}
              savings={search?.savings}
            />
          </Section>
        )}

        <PriceCheck home={home} search={search} />

        <OfferAdvice home={home} />

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
