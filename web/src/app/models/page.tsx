import type { Metadata } from "next";
import { GroupedBars, HBars, OURS, Scatter, Stat, TableView, ZILLOW, Legend } from "@/components/charts";
import { Section } from "@/components/section";
import { money } from "@/lib/format";
import { BASELINE, ENSEMBLE, loadModelCard } from "@/lib/model-card";

export const metadata: Metadata = { title: "Our models" };

const pct = (n: number) => `${n.toFixed(1)}%`;
const MODEL_ORDER: [string, string][] = [
  ["Ridge (baseline)", "Simple linear baseline"],
  ["LightGBM (tuned)", "Tree model, best of 4 settings"],
  ["XGBoost", "Tree model"],
  ["CatBoost", "Tree model"],
  ["Ensemble (LGBM+XGB+Cat)", "Average of the three tree models: our final model"],
];

export default function ModelsPage() {
  const card = loadModelCard();
  if (!card) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="display text-4xl">Model results are not loaded</h1>
        <p className="mt-4 text-ink-2">Run the notebook&apos;s export step and copy its output into web/data/ours.</p>
      </div>
    );
  }

  const { same_homes: same } = card;
  const ours = card.models[ENSEMBLE];
  const base = card.models[BASELINE];
  const omitted = card.scatter.filter(([p, o, z]) => p > 1_500_000 || o > 1_500_000 || z > 1_500_000).length;

  return (
    <div className="mx-auto max-w-6xl space-y-20 px-4 py-14 sm:px-6">
      <header className="max-w-3xl">
        <p className="eyebrow">Our models</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">How good is our price model?</h1>
        <p className="mt-5 text-lg text-ink-2">
          We trained five models on {card.n_homes.toLocaleString("en-US")} Houston-area listings (June 2024) to estimate what a home like
          each one usually lists for. Here are the real results, including where Zillow&apos;s own estimate, the Zestimate, beats us.
        </p>
      </header>

      <Section eyebrow="Head to head" title="Our model vs Zillow's Zestimate">
        <p className="mb-6 max-w-3xl text-ink-2">
          Both are scored against the same {same.n.toLocaleString("en-US")} homes that have a Zestimate. Each of our estimates is
          out-of-sample: made by a model that never saw that home.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Our typical error" value={pct(same.ours.medape)} sub="Half of homes are off by less than this" color={OURS} />
          <Stat label="Zestimate typical error" value={pct(same.zillow.medape)} sub="Same homes, same measure" color={ZILLOW} />
          <Stat label="Our average miss" value={money(same.ours.mae)} sub={`R² ${same.ours.r2.toFixed(2)}`} color={OURS} />
          <Stat label="Zestimate average miss" value={money(same.zillow.mae)} sub={`R² ${same.zillow.r2.toFixed(2)}`} color={ZILLOW} />
        </div>
        <div className="mt-6 max-w-3xl space-y-3 rounded-xl border border-line bg-card p-5 text-ink-2">
          <p>
            <strong className="text-ink">Zillow&apos;s Zestimate is clearly more accurate.</strong> It misses by about{" "}
            {money(same.zillow.mae)} on average; we miss by about {money(same.ours.mae)}. We are not claiming to beat it.
          </p>
          <p>
            That makes sense. We only use what is in the listing file (size, location, home type, new construction, county
            assessed value). We have no year built, condition, photos or sale history, and Zillow has far more data and years of tuning.
          </p>
          <p>
            One caution: these are homes currently for sale, and a Zestimate for a listed home may already take the asking price into
            account. If it does, this comparison flatters it. We cannot tell that from the data, so read the gap as an upper bound on
            Zillow&apos;s lead.
          </p>
          <p>
            What we add is not a better estimate. It is what we do with one: check the fair price against the asking price, warn about
            flood-prone zips, and tie it all to what a household can afford.
          </p>
        </div>
      </Section>

      <Section eyebrow="Model comparison" title="Which model did best?">
        <p className="mb-6 max-w-3xl text-ink-2">
          Average dollar miss for each model on all {card.n_homes.toLocaleString("en-US")} homes, using 5-fold cross-validation (shorter is
          better). The three tree models cut the miss by about {Math.round((1 - ours.mae / base.mae) * 100)}% compared with the simple baseline.
        </p>
        <HBars
          rows={MODEL_ORDER.map(([k, note]) => ({ label: k.replace(" (LGBM+XGB+Cat)", ""), note, value: card.models[k].mae }))}
          format={(n) => money(n)}
          labelWidth="13rem"
        />
        <TableView
          caption="Model comparison"
          head={["Model", "Average miss", "Median error", "Average error", "R²"]}
          rows={MODEL_ORDER.map(([k]) => [k, money(card.models[k].mae), pct(card.models[k].medape), pct(card.models[k].mape), card.models[k].r2.toFixed(2)])}
        />
      </Section>

      <Section eyebrow="Where it works" title="Error by price range">
        <p className="mb-6 max-w-3xl text-ink-2">
          Typical error (median, as a share of the price) in each price range. Both models are weakest at the cheap end, which is where
          buyers on a tight budget shop. Our weakest range is under $200,000, so treat bargains there with extra care.
        </p>
        <GroupedBars
          groups={card.bands.map((b) => ({ label: b.band, note: `${b.n.toLocaleString("en-US")} homes`, ours: b.ours.medape, zillow: b.zillow.medape }))}
          format={pct}
          oursLabel="Our model"
          zillowLabel="Zillow Zestimate"
        />
        <TableView
          caption="Typical error by price range"
          head={["Price range", "Homes", "Our typical error", "Zestimate typical error", "Our average miss", "Zestimate average miss"]}
          rows={card.bands.map((b) => [b.band, b.n.toLocaleString("en-US"), pct(b.ours.medape), pct(b.zillow.medape), money(b.ours.mae), money(b.zillow.mae)])}
        />
      </Section>

      <Section eyebrow="Predicted vs actual" title="How close are the estimates?">
        <p className="mb-6 max-w-3xl text-ink-2">
          Each dot is a home: its asking price across, the estimate up. A dot on the dashed line was estimated exactly. A tighter cloud
          around the line is a better model. Random sample of {card.scatter.length.toLocaleString("en-US")} homes
          {omitted > 0 ? `; ${omitted} above $1.5M are off the chart` : ""}.
        </p>
        <Legend items={[{ label: "Our model", color: OURS }, { label: "Zillow Zestimate", color: ZILLOW }]} />
        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <Scatter title="Our model" color={OURS} points={card.scatter.map(([p, o]) => [p, o])} />
          <Scatter title="Zillow Zestimate" color={ZILLOW} points={card.scatter.map(([p, , z]) => [p, z])} />
        </div>
        <TableView
          caption="Accuracy summary on the same homes"
          head={["", "Average miss", "Median error", "Average error", "R²"]}
          rows={[
            ["Our model", money(same.ours.mae), pct(same.ours.medape), pct(same.ours.mape), same.ours.r2.toFixed(2)],
            ["Zillow Zestimate", money(same.zillow.mae), pct(same.zillow.medape), pct(same.zillow.mape), same.zillow.r2.toFixed(2)],
          ]}
        />
      </Section>

      <Section eyebrow="Inside the model" title="What drives the price?">
        <p className="mb-6 max-w-3xl text-ink-2">
          How much, on average, each factor moves a home&apos;s estimated price up or down. Size matters most, then the county&apos;s assessed
          value and how expensive the zip usually is.
        </p>
        <HBars rows={card.importance.slice(0, 8).map(([label, value]) => ({ label, value }))} format={(n) => `±${n.toFixed(1)}%`} labelWidth="15rem" />
        <TableView caption="What drives the price" head={["Factor", "Typical swing in price"]} rows={card.importance.map(([l, v]) => [l, `±${v.toFixed(1)}%`])} />
      </Section>

      <Section eyebrow="Read this" title="What these numbers do and don't mean">
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-ink-2">
          <li>The models learn <strong className="text-ink">asking prices</strong>, not final sale prices. &quot;Fair&quot; means what similar homes list for.</li>
          <li>They cannot see condition, age, photos or the street. A cheap home may be cheap for a real reason.</li>
          <li>The data is one June 2024 snapshot, so prices will have moved.</li>
          <li>
            A &quot;Real bargain&quot; needs all three tree models to say the asking price is at least 10% below fair. That cuts noise, but it is
            still a screening tool, not a verdict.
          </li>
          <li>Accuracy is measured out-of-sample with 5-fold cross-validation, so the numbers are not flattered by memorizing the data.</li>
        </ul>
      </Section>
    </div>
  );
}
