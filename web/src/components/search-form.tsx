import { ArrowRight } from "lucide-react";

type Props = {
  zip?: string;
  rent?: string | number;
  errors?: { zip?: string; rent?: string };
  size?: "hero" | "bar";
  keep?: Record<string, string>;
};

export function SearchForm({ zip = "", rent = "", errors = {}, size = "hero", keep = {} }: Props) {
  const hero = size === "hero";
  const input = hero
    ? "border-b-2 border-ink/40 bg-transparent text-center tabular-nums outline-none focus:border-accent"
    : "field w-24 py-1 tabular-nums";

  return (
    <form action="/homes" method="get" noValidate className={hero ? "" : "text-base"}>
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className={hero ? "display text-3xl leading-snug sm:text-5xl sm:leading-snug" : "flex flex-wrap items-center gap-2"}>
        <span>{hero ? "I want a home in " : "Where: "}</span>
        <label className="sr-only" htmlFor={`zip-${size}`}>
          Zip code (optional, leave blank for all of Houston)
        </label>
        <input
          id={`zip-${size}`}
          name="zip"
          defaultValue={zip}
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{5}"
          maxLength={5}
          placeholder="anywhere"
          aria-invalid={Boolean(errors.zip)}
          aria-describedby={errors.zip ? `zip-${size}-error` : undefined}
          className={hero ? `${input} mx-1 w-[5.4em]` : input}
        />
        <span>{hero ? " and can spend " : " · Budget: "}</span>
        <span className={hero ? "whitespace-nowrap" : "inline-flex items-center gap-1"}>
          <span aria-hidden>$</span>
          <label className="sr-only" htmlFor={`rent-${size}`}>
            Monthly housing budget in dollars
          </label>
          <input
            id={`rent-${size}`}
            name="rent"
            defaultValue={rent}
            inputMode="numeric"
            required
            placeholder="1,850"
            aria-invalid={Boolean(errors.rent)}
            aria-describedby={errors.rent ? `rent-${size}-error` : undefined}
            className={hero ? `${input} mx-1 w-[3.6em]` : input}
          />
        </span>
        <span> {hero ? "a month." : "a month"}</span>
        {!hero && (
          <button type="submit" className="rounded-md bg-navy px-3 py-1.5 text-sm font-semibold text-on-navy">
            Update
          </button>
        )}
      </p>
      {hero && (
        <p className="mt-4 max-w-xl text-base text-ink-2">
          Leave the zip code blank to search all of Houston. Your budget can be your rent today, or the most you would
          comfortably spend each month on a home.
        </p>
      )}
      <div aria-live="polite" className="mt-2 space-y-1 text-sm text-over">
        {errors.zip && <p id={`zip-${size}-error`}>{errors.zip}</p>}
        {errors.rent && <p id={`rent-${size}-error`}>{errors.rent}</p>}
      </div>
      {hero && (
        <button
          type="submit"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-navy px-6 py-3 font-semibold text-on-navy transition-colors hover:bg-ink"
        >
          Show me homes I could own
          <ArrowRight className="size-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
