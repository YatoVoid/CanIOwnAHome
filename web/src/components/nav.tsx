"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Find homes", match: (p: string) => p === "/" || p.startsWith("/homes") },
  { href: "/what-if", label: "What if?", match: (p: string) => p.startsWith("/what-if") },
  { href: "/models", label: "Our models", match: (p: string) => p.startsWith("/models") },
  { href: "/flood", label: "Flood", match: (p: string) => p.startsWith("/flood") },
];

/** Same links without the highlighted tab: shown while the current URL is not known yet. */
export function NavFallback() {
  return (
    <nav aria-label="Main" className="-mb-px flex gap-1 overflow-x-auto text-sm sm:gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 font-medium text-ink-2 hover:text-ink">
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="-mb-px flex gap-1 overflow-x-auto text-sm sm:gap-2">
      {TABS.map((t) => {
        const active = t.match(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 font-medium ${
              active ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
