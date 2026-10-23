import { ExternalLink } from "lucide-react";
import { RATE_INFO } from "@/lib/rates";

/** The rates and rules behind every number, with links to check them. Collapsed by default. */
export function RatesPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-line bg-card">
      <summary className="cursor-pointer list-none px-5 py-3 font-semibold marker:hidden">
        View the rates we use
        <span className="ml-2 text-sm font-normal text-ink-3 group-open:hidden">(and where to check them)</span>
      </summary>
      <div className="border-t border-line px-5 py-4">
        <p className="text-sm text-ink-2">
          These are our starting assumptions, not a loan offer. You can change the interest rate and loan term in the
          controls on the results page. Use the numbers from your lender when you have them.
        </p>
        <dl className="mt-4 divide-y divide-line">
          {RATE_INFO.map((r) => (
            <div key={r.key} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
              <dt>
                <span className="block font-medium">{r.label}</span>
                <span className="figure text-lg">{r.value}</span>
              </dt>
              <dd className="text-sm text-ink-2">
                {r.detail}
                {r.links.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {r.links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-ink underline underline-offset-4"
                      >
                        {l.text} <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ))}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
