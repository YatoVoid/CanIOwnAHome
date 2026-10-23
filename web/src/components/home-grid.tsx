"use client";

import Image from "next/image";
import Link from "next/link";
import { useAssumptions } from "@/components/assumptions";
import { FitBadge } from "@/components/fit-badge";
import { costBreakdown } from "@/lib/finance";
import { bathsLabel, count, money, photoAt } from "@/lib/format";
import { homeTypeLabel, type Listing } from "@/lib/listing";

export function HomeGrid({ homes, zip, rent }: { homes: Listing[]; zip: string; rent: number }) {
  const { assumptions } = useAssumptions();
  const rows = homes.map((home) => ({ home, monthly: costBreakdown(home.price, home.hoaMonthly, assumptions).total }));

  return (
    <ol className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ home, monthly }, i) => (
        <li key={home.id}>
          <Link
            href={`/homes/${home.id}?zip=${zip}&rent=${rent}`}
            className="group block rounded-lg focus-visible:outline-offset-4"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-sunk">
              {home.photos[0] && (
                <Image
                  src={photoAt(home.photos[0], "card")}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  priority={i < 3}
                />
              )}
              <span className="absolute left-3 top-3 rounded bg-navy/85 px-2 py-0.5 text-xs font-semibold tabular-nums text-on-navy">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <p className="figure text-3xl">
                {money(monthly)}
                <span className="font-sans text-sm text-ink-3">/mo</span>
              </p>
              <p className="text-sm tabular-nums text-ink-2">{money(home.price)}</p>
            </div>
            <div className="mt-1.5">
              <FitBadge monthly={monthly} rent={rent} />
            </div>
            <p className="mt-2 font-medium group-hover:underline group-hover:underline-offset-4">
              {home.address.street}
            </p>
            <p className="text-sm text-ink-3">
              {[
                home.beds != null && `${home.beds} bd`,
                home.baths != null && `${bathsLabel(home.baths)} ba`,
                home.sqft != null && `${count(home.sqft)} sqft`,
                homeTypeLabel(home.homeType),
                home.address.zip !== zip && home.address.zip,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
