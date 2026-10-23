"use client";

import { floodCounts } from "@/lib/flood";
import type { Listing } from "@/lib/listing";

/** Flood check for the whole result list, with a switch to hide homes in high flood-claim zips. */
export function FloodSummary({
  homes,
  hideHigh,
  onToggle,
}: {
  homes: Listing[];
  hideHigh: boolean;
  onToggle: (v: boolean) => void;
}) {
  const c = floodCounts(homes);
  if (c.High + c.Medium + c.Low === 0) return null;
  const total = homes.length;

  return (
    <section className="border-b border-line py-8" aria-labelledby="flood-heading">
      <p className="eyebrow">Flood check</p>
      <h2 id="flood-heading" className="display mt-2 text-3xl sm:text-4xl">
        {c.High > 0 ? (
          <>
            {c.High} of these {total} homes are in <span className="text-over">high flood-claim</span> zips
          </>
        ) : (
          <>None of these {total} homes are in high flood-claim zips</>
        )}
      </h2>
      <p className="mt-3 max-w-2xl text-ink-2">
        Houston floods, and a low price can be the price of flood risk. Each home shows the flood-insurance claim level of its zip code,
        from FEMA data. It is a zip-level screening signal, not a flood map for the house.
      </p>

      <ul className="mt-5 flex flex-wrap gap-3 text-sm">
        <li className="rounded-full bg-good-bg px-3 py-1 font-semibold text-good">Low: {c.Low} homes</li>
        <li className="rounded-full bg-near-bg px-3 py-1 font-semibold text-near">Medium: {c.Medium} homes</li>
        <li className="rounded-full bg-over-bg px-3 py-1 font-semibold text-over">High: {c.High} homes</li>
        {c.traps > 0 && (
          <li className="rounded-full border border-over/40 px-3 py-1 font-semibold text-over">
            {c.traps} look cheap because of flood risk (possible flood traps)
          </li>
        )}
      </ul>

      <label className="mt-5 flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={hideHigh} onChange={(e) => onToggle(e.target.checked)} className="size-4 accent-[var(--navy,#1c2a42)]" />
        <span>Hide homes in high flood-claim zips</span>
      </label>
    </section>
  );
}
