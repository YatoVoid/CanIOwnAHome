import { HomeChat } from "@/components/home-chat";
import { RatesPanel } from "@/components/rates-panel";
import { SearchForm } from "@/components/search-form";

const STEPS = [
  ["Tell us three numbers", "Your yearly income, your rent, and your savings. Add a zip code, or leave it blank to search all of Houston."],
  ["We work out what you can afford", "A simple formula turns your income, debts and savings into a monthly budget and a top price, using rates you can check."],
  ["Our models pick and judge the homes", "A trained price model finds homes in your budget, says if each price is fair, and warns you if a cheap home sits in a flood-prone area."],
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">Houston home affordability check</p>
          <h1 className="display mt-4 max-w-3xl text-5xl sm:text-7xl">Your rent might already cover a mortgage.</h1>
          <div className="mt-12">
            <SearchForm />
          </div>
        </div>
        <ol className="space-y-6 border-l border-line pl-6">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <p className="figure text-sm text-accent-ink">0{i + 1}</p>
              <p className="font-semibold">{title}</p>
              <p className="text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Rates and assumptions" className="border-t border-line py-10">
        <RatesPanel />
      </section>

      <section aria-labelledby="chat-heading" className="border-t border-line py-16">
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow">Or describe it</p>
          <h2 id="chat-heading" className="display mt-3 text-4xl sm:text-5xl">
            Tell us who&apos;s moving in
          </h2>
          <p className="mt-3 text-lg text-ink-2">
            Household size, a yard, an extra bedroom for an office. Describe it in your own words and the search will
            narrow to homes that fit.
          </p>
        </div>
        <HomeChat />
      </section>
    </div>
  );
}
