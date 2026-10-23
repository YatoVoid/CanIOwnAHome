import { ArrowRight } from "lucide-react";

type Values = { income?: string | number; rent?: string | number; savings?: string | number; debts?: string | number; zip?: string };
type Errors = Partial<Record<"income" | "rent" | "savings" | "debts" | "zip", string>>;

type Props = { values?: Values; errors?: Errors; size?: "hero" | "bar"; keep?: Record<string, string> };

export function SearchForm({ values = {}, errors = {}, size = "hero", keep = {} }: Props) {
  const hero = size === "hero";
  const big = "border-b-2 border-ink/40 bg-transparent text-center tabular-nums outline-none focus:border-accent";

  const num = (name: "income" | "rent" | "savings" | "debts", placeholder: string, label: string, width: string, required = true) => (
    <>
      <label className="sr-only" htmlFor={`${name}-${size}`}>
        {label}
      </label>
      <input
        id={`${name}-${size}`}
        name={name}
        defaultValue={values[name]}
        inputMode="numeric"
        required={required}
        placeholder={placeholder}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-${size}-error` : undefined}
        className={hero ? `${big} mx-1 ${width}` : "field w-28 py-1 tabular-nums"}
      />
    </>
  );

  const zipInput = (
    <input
      id={`zip-${size}`}
      name="zip"
      defaultValue={values.zip}
      inputMode="numeric"
      autoComplete="postal-code"
      pattern="\d{5}"
      maxLength={5}
      placeholder="anywhere"
      aria-label="Zip code (optional, leave blank for all of Houston)"
      aria-invalid={Boolean(errors.zip)}
      aria-describedby={errors.zip ? `zip-${size}-error` : undefined}
      className={hero ? "field w-32 py-1" : "field w-28 py-1"}
    />
  );

  const messages = (["income", "rent", "savings", "debts", "zip"] as const).filter((k) => errors[k]);

  return (
    <form action="/homes" method="get" noValidate className={hero ? "" : "text-base"}>
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {hero ? (
        <>
          <p className="display text-3xl leading-snug sm:text-5xl sm:leading-snug">
            I earn <span className="whitespace-nowrap">$ {num("income", "70,000", "Yearly income before taxes, in dollars", "w-[4.4em]")}</span> a year, pay{" "}
            <span className="whitespace-nowrap">$ {num("rent", "1,500", "Monthly rent, in dollars", "w-[3.6em]")}</span> a month in rent, and have{" "}
            <span className="whitespace-nowrap">$ {num("savings", "20,000", "Savings, in dollars", "w-[4.4em]")}</span> saved.
          </p>
          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4 text-base">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3">Monthly debts (optional)</span>
              <span className="field inline-flex items-center gap-1 py-1">
                <span aria-hidden>$</span>
                <input
                  id={`debts-${size}`}
                  name="debts"
                  defaultValue={values.debts}
                  inputMode="numeric"
                  placeholder="300"
                  aria-invalid={Boolean(errors.debts)}
                  className="w-24 bg-transparent tabular-nums outline-none"
                />
              </span>
              <span className="mt-1 block text-xs text-ink-3">Car, student loans, credit cards</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3">Where (optional)</span>
              {zipInput}
              <span className="mt-1 block text-xs text-ink-3">Zip code, or blank for all of Houston</span>
            </label>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 text-sm">
          {(
            [
              ["income", "Income a year", "70,000"],
              ["rent", "Rent a month", "1,500"],
              ["savings", "Savings", "20,000"],
              ["debts", "Debts a month", "0"],
            ] as const
          ).map(([name, label, ph]) => (
            <label key={name} className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>$</span>
                <input
                  id={`${name}-${size}`}
                  name={name}
                  defaultValue={values[name]}
                  inputMode="numeric"
                  placeholder={ph}
                  aria-invalid={Boolean(errors[name])}
                  className="field w-28 py-1 tabular-nums"
                />
              </span>
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3">Zip (optional)</span>
            {zipInput}
          </label>
          <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-on-navy">
            Update
          </button>
        </div>
      )}

      <div aria-live="polite" className="mt-3 space-y-1 text-sm text-over">
        {messages.map((k) => (
          <p key={k} id={`${k}-${size}-error`}>
            {errors[k]}
          </p>
        ))}
      </div>

      {hero && (
        <button
          type="submit"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-navy px-6 py-3 font-semibold text-on-navy transition-colors hover:bg-ink"
        >
          Show me what I can afford
          <ArrowRight className="size-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
