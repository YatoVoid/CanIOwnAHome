"use client";

export default function HomesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="display mt-3 text-4xl">We couldn&apos;t load homes right now</h1>
      <p className="mt-4 text-ink-2">The pricing model didn&apos;t answer in time. Try again in a moment.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-md bg-navy px-5 py-2.5 font-semibold text-on-navy"
      >
        Try again
      </button>
    </div>
  );
}
