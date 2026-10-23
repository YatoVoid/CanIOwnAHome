import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="eyebrow">Not found</p>
      <h1 className="display mt-3 text-4xl">That home isn&apos;t listed anymore</h1>
      <p className="mt-4 text-ink-2">It may have sold or been taken off the market.</p>
      <Link href="/" className="mt-8 inline-block underline underline-offset-4">
        Start a new search
      </Link>
    </div>
  );
}
