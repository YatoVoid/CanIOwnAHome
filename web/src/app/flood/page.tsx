import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { HBars, OURS, Stat, TableView } from "@/components/charts";
import { Section } from "@/components/section";
import { money } from "@/lib/format";
import { loadModelCard } from "@/lib/model-card";

export const metadata: Metadata = { title: "Flood" };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(0)}%`;

/** The estimate and its plausible range on a % axis, with a line at "no effect". */
function EffectBar({ pct, lo, hi }: { pct: number; lo: number; hi: number }) {
  const min = -30;
  const max = 10;
  const W = 560;
  const H = 96;
  const x = (v: number) => 24 + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (W - 48);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="w-full max-w-xl" aria-label={`Estimated price difference ${signed(pct)}, plausible range ${signed(lo)} to ${signed(hi)}`}>
      {[-30, -20, -10, 0, 10].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={34} y2={58} stroke="var(--line)" strokeWidth={1} />
          <text x={x(t)} y={76} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
            {t > 0 ? `+${t}%` : t < 0 ? `−${Math.abs(t)}%` : "0%"}
          </text>
        </g>
      ))}
      <line x1={x(0)} x2={x(0)} y1={26} y2={62} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={x(0)} y={18} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
        no price difference
      </text>
      <line x1={x(lo)} x2={x(hi)} y1={46} y2={46} stroke={OURS} strokeWidth={4} strokeLinecap="round" />
      <circle cx={x(pct)} cy={46} r={7} fill={OURS} stroke="var(--card)" strokeWidth={2} />
    </svg>
  );
}

export default function FloodPage() {
  const card = loadModelCard();
  const flood = card?.flood;
  if (!card || !flood) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="display text-4xl">Flood results are not loaded</h1>
        <p className="mt-4 text-ink-2">Run the notebook with flood data and copy its export into web/data/ours.</p>
      </div>
    );
  }

  const { effect } = flood;
  const level = (name: string) => flood.by_level.find((l) => l.level === name);
  const totalTraps = flood.by_level.reduce((s, l) => s + l.traps, 0);
  const totalBargains = flood.by_level.reduce((s, l) => s + l.bargains, 0);
  const ambiguous = effect.lo < 0 && effect.hi > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-20 px-4 py-14 sm:px-6">
      <header className="max-w-3xl">
        <p className="eyebrow">Flood</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">Is a cheap home cheap because it floods?</h1>
        <p className="mt-5 text-lg text-ink-2">
          Houston homebuyers know the answer can be yes. Here is what the data says: how we measure flood risk, whether prices reflect it,
          and which homes look cheap for that reason.
        </p>
      </header>

      <Section eyebrow="How we measure it" title="Flood-insurance claims, zip by zip">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Claims counted" value={flood.claims_total.toLocaleString("en-US")} sub="FEMA flood-insurance claims in 8 Houston-area counties" />
          <Stat label="Zips scored" value={String(flood.zips)} sub="Each gets a 0 to 1 rank by claims per listing" />
          <Stat label="High flood-claim homes" value={(level("High")?.homes ?? 0).toLocaleString("en-US")} sub="In the top quarter of zips by claims per listing" />
        </div>
        <p className="mt-6 max-w-3xl text-ink-2">
          For each zip we count FEMA flood-insurance claims and divide by how many homes are listed there, then rank the zips. The top quarter
          is labeled <strong className="text-ink">High</strong>, the next band <strong className="text-ink">Medium</strong>, the rest{" "}
          <strong className="text-ink">Low</strong>. It covers one zip as a whole, not a single house.
        </p>
      </Section>

      <Section eyebrow="The big question" title="Do prices reflect flood risk?">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <EffectBar pct={effect.pct} lo={effect.lo} hi={effect.hi} />
            <p className="mt-2 text-sm text-ink-3">
              Difference in price per square foot between the most and least flood-claim-heavy zips, holding home size, distance to downtown
              and new construction equal. Dot is the best estimate; the bar is the plausible range. {effect.n_zips} zips.
            </p>
          </div>
          <div className="space-y-3 text-ink-2">
            <p className="text-lg text-ink">
              Best estimate: <strong>{signed(effect.pct)}</strong> per square foot, with a plausible range of{" "}
              <strong>
                {signed(effect.lo)} to {signed(effect.hi)}
              </strong>
              .
            </p>
            <p>
              {ambiguous
                ? "The range includes zero, so we cannot say flood risk is reliably priced in. If there is a discount, it is modest: about a tenth, not the steep drop you might hope for."
                : "The whole range sits on one side of zero, so the price difference looks real."}
            </p>
            <p>
              Our data cannot tell whether a discount like that covers the real cost of flood damage and flood insurance. That is why this site
              warns you about flood-prone zips instead of assuming the price already accounts for it.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="By flood level" title="What homes cost in each group">
        <p className="mb-6 max-w-3xl text-ink-2">Median asking price per square foot, for all homes in each flood-claim level (not adjusted for size or location).</p>
        <HBars
          rows={flood.by_level.map((l) => ({ label: `${l.level} flood-claim zips`, note: `${l.homes.toLocaleString("en-US")} homes in ${l.zips} zips`, value: l.median_ppsf }))}
          format={(n) => `$${Math.round(n)} / sqft`}
          labelWidth="13rem"
        />
        <TableView
          caption="Homes by flood level"
          head={["Flood level", "Homes", "Zips", "Median price", "Median $/sqft", "Real bargains", "Possible flood traps"]}
          rows={flood.by_level.map((l) => [l.level, l.homes.toLocaleString("en-US"), l.zips, money(l.median_price), `$${Math.round(l.median_ppsf)}`, l.bargains, l.traps])}
        />
      </Section>

      <Section eyebrow="Flood traps" title="Cheap homes we flag instead of recommending">
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Real bargains" value={totalBargains.toLocaleString("en-US")} sub="10%+ below fair price, all three models agree, not in a high flood-claim zip" />
          <Stat label="Possible flood traps" value={totalTraps.toLocaleString("en-US")} sub="Same price signal, but in a high flood-claim zip" />
        </div>
        <p className="mt-6 max-w-3xl text-ink-2">
          A home that looks 10% or more below fair price in a zip with lots of flood claims may be cheap for exactly that reason. Instead of
          calling it a bargain, we label it a possible flood trap. You can hide high flood-claim zips from any search with one tick box.
        </p>
      </Section>

      <Section eyebrow="Highest claim rates" title="The ten zips with the most flood claims per listing">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Zips with the highest flood-claim rates</caption>
            <thead>
              <tr className="border-b border-line text-ink-3">
                {["Zip", "Area", "Claims per listing", "Homes listed", "Median price", "Median $/sqft"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flood.top_zips.map((z) => (
                <tr key={z.zip} className="border-b border-line/60">
                  <td className="py-2 pr-4 font-medium tabular-nums">{z.zip}</td>
                  <td className="py-2 pr-4">{z.city}</td>
                  <td className="py-2 pr-4 tabular-nums">{z.rate.toFixed(1)}</td>
                  <td className="py-2 pr-4 tabular-nums">{z.homes}</td>
                  <td className="py-2 pr-4 tabular-nums">{money(z.median_price)}</td>
                  <td className="py-2 pr-4 tabular-nums">${Math.round(z.median_ppsf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-ink-3">Zips with at least 30 listings. Claims per listing is smoothed so zips with few listings are not noisy.</p>
      </Section>

      <Section eyebrow="Read this" title="What this can and can't tell you">
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-ink-2">
          <li>Claims exist only for homes that carry flood insurance, so uninsured flooding is missed.</li>
          <li>We divide by the number of homes listed in the zip as a rough stand-in for how many homes there are.</li>
          <li>The level describes the whole zip. Flood risk can differ a lot from one street to the next.</li>
          <li>Counting claims also reflects where storms hit and how many people file, not only where land floods.</li>
          <li>Check any home you like on FEMA&apos;s flood map and ask the seller about its flood history before you buy.</li>
        </ul>
        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href="https://msc.fema.gov/portal/home" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
            FEMA flood map <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <a href="https://www.floodsmart.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
            Flood insurance basics <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>
      </Section>
    </div>
  );
}
