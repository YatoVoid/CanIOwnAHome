import { HomeChat } from "@/components/home-chat";
import { SearchForm } from "@/components/search-form";

const STEPS = [
  ["Tell us two numbers", "Your zip code and what you pay in rent today."],
  ["We find the homes", "A pricing model picks listings near you that would cost about the same per month to own."],
  ["Walk through each one", "Photos, a plain description, and the full monthly cost next to your rent."],
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">Houston rent-to-own check</p>
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
