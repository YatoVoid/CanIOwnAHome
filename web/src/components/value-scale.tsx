import { compactMoney, money } from "@/lib/format";

type Mark = { key: string; label: string; value: number; note: string };

/** Dot plot of the list price against independent value reads, on one shared scale. */
export function ValueScale({ marks, price }: { marks: Mark[]; price: number }) {
  const all = [price, ...marks.map((m) => m.value)];
  const pad = (Math.max(...all) - Math.min(...all)) * 0.15 || price * 0.1;
  const lo = Math.min(...all) - pad;
  const hi = Math.max(...all) + pad;
  const frac = (v: number) => (v - lo) / (hi - lo);
  const pos = (v: number) => `${frac(v) * 100}%`;

  return (
    <figure className="rounded-xl border border-line bg-card p-5 sm:p-6">
      <figcaption className="font-semibold">Where the asking price sits</figcaption>
      <ul className="mt-6 space-y-5">
        {[{ key: "list", label: "Asking price", value: price, note: "What the seller wants" }, ...marks].map((m) => {
          const isList = m.key === "list";
          return (
            <li key={m.key} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-4">
              <div>
                <p className={`text-sm ${isList ? "font-semibold" : ""}`}>{m.label}</p>
                <p className="text-xs text-ink-3">{m.note}</p>
              </div>
              <div className="relative h-8">
                <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: pos(m.value) }}
                  title={`${m.label}: ${money(m.value)}`}
                >
                  <span
                    className={`block size-3 rounded-full ring-2 ring-card ${isList ? "bg-accent" : "bg-[var(--series-1)]"}`}
                  />
                </div>
                <span
                  className={`absolute top-1/2 -translate-y-1/2 text-sm tabular-nums ${frac(m.value) > 0.6 ? "pr-3" : "pl-3"}`}
                  style={frac(m.value) > 0.6 ? { right: `${(1 - frac(m.value)) * 100}%` } : { left: pos(m.value) }}
                >
                  {money(m.value)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-between text-xs tabular-nums text-ink-3 sm:ml-[12rem]">
        <span>{compactMoney(lo)}</span>
        <span>{compactMoney(hi)}</span>
      </div>
    </figure>
  );
}
