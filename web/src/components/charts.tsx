import type { ReactNode } from "react";

// Chart colors: two categorical series that pass the CVD / contrast checks in light and dark (tokens in globals.css).
export const OURS = "var(--series-1)";
export const ZILLOW = "var(--series-2)";

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Every chart has a table view: the same numbers, readable by screen readers and easy to copy. */
export function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-ink-2 underline underline-offset-4">View as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line text-ink-3">
              {head.map((h) => (
                <th key={h} scope="col" className="py-1.5 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line/60">
                {r.map((c, j) => (
                  <td key={j} className="py-1.5 pr-4 tabular-nums">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

type Row = { label: string; value: number; note?: string };

/** One series, horizontal bars from zero, the value written at the end of each bar. */
export function HBars({ rows, format, color = OURS, labelWidth = "11rem" }: { rows: Row[]; format: (n: number) => string; color?: string; labelWidth?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid items-center gap-3" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
          <span className="text-sm text-ink">
            {r.label}
            {r.note && <span className="block text-xs text-ink-3">{r.note}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 rounded-r"
              style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%`, maxWidth: "calc(100% - 4.5rem)", background: color, borderRadius: "0 4px 4px 0" }}
              role="img"
              aria-label={`${r.label}: ${format(r.value)}`}
            />
            <span className="shrink-0 text-sm tabular-nums text-ink-2">{format(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type Group = { label: string; note?: string; ours: number; zillow: number };

/** Two series side by side per group (ours vs Zillow), each bar from zero with its value written at the end. */
export function GroupedBars({ groups, format, oursLabel, zillowLabel }: { groups: Group[]; format: (n: number) => string; oursLabel: string; zillowLabel: string }) {
  const max = Math.max(...groups.flatMap((g) => [g.ours, g.zillow]), 1);
  const bar = (v: number, color: string, label: string) => (
    <span className="flex items-center gap-2">
      <span
        className="h-3"
        style={{ width: `${Math.max((v / max) * 100, 1.5)}%`, maxWidth: "calc(100% - 4.5rem)", background: color, borderRadius: "0 4px 4px 0" }}
        role="img"
        aria-label={`${label}: ${format(v)}`}
      />
      <span className="shrink-0 text-sm tabular-nums text-ink-2">{format(v)}</span>
    </span>
  );
  return (
    <div>
      <Legend items={[{ label: oursLabel, color: OURS }, { label: zillowLabel, color: ZILLOW }]} />
      <ul className="mt-4 space-y-4">
        {groups.map((g) => (
          <li key={g.label} className="grid items-center gap-3" style={{ gridTemplateColumns: "9rem 1fr" }}>
            <span className="text-sm text-ink">
              {g.label}
              {g.note && <span className="block text-xs text-ink-3">{g.note}</span>}
            </span>
            <span className="space-y-1.5">
              {bar(g.ours, OURS, `${g.label}, ${oursLabel}`)}
              {bar(g.zillow, ZILLOW, `${g.label}, ${zillowLabel}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const compact = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}k`);

/** Asking price (x) against an estimate (y). Dots on the dashed line were predicted exactly. */
export function Scatter({ points, color, title, max = 1_500_000 }: { points: [number, number][]; color: string; title: string; max?: number }) {
  const W = 440;
  const H = 400;
  const m = { l: 56, r: 30, t: 12, b: 40 };
  const x = (v: number) => m.l + (Math.min(v, max) / max) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (Math.min(v, max) / max) * (H - m.t - m.b);
  const ticks = [0, 500_000, 1_000_000, 1_500_000];
  const shown = points.filter(([a, b]) => a <= max && b <= max);
  return (
    <figure>
      <figcaption className="mb-1 text-sm font-semibold">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: estimate against asking price for ${shown.length} homes`} className="w-full max-w-md">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {t === 0 ? "$0" : compact(t)}
            </text>
            <text x={x(t)} y={H - m.b + 16} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
              {t === 0 ? "$0" : compact(t)}
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 4" />
        {shown.map(([a, b], i) => (
          <circle key={i} cx={x(a)} cy={y(b)} r={2.6} fill={color} fillOpacity={0.45} />
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
          Asking price
        </text>
        <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
          Estimate
        </text>
      </svg>
    </figure>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
        {color && <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: color }} />}
        {label}
      </p>
      <p className="figure mt-2 text-4xl">{value}</p>
      {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
    </div>
  );
}
