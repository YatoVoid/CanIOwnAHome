import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import Link from "next/link";
import { AssumptionsProvider } from "@/components/assumptions";
import { Suspense } from "react";
import { Nav, NavFallback } from "@/components/nav";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Can I Own a Home?", template: "%s · Can I Own a Home?" },
  description: "Enter your income, rent and savings. See what you can afford in Houston, which homes are fairly priced, and whether a cheap home is cheap because it floods.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${instrument.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-2 px-4 pt-4 sm:px-6">
            <Link href="/" className="display pb-2 text-xl">
              Can I Own a Home<span className="text-accent">?</span>
            </Link>
            <Suspense fallback={<NavFallback />}>
              <Nav />
            </Suspense>
          </div>
        </header>
        <AssumptionsProvider>
          <main id="main" className="flex-1">
            {children}
          </main>
        </AssumptionsProvider>
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-ink-3 sm:px-6">
            <p>
              Monthly costs are estimates from list price, your assumptions, and Houston-area averages for tax and
              insurance. They are not a loan offer. Get a quote from a lender before you make a decision.
            </p>
            <p>Listing data and photos come from public listings and may be out of date.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
