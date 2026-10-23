import type { ReactNode } from "react";

export function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mb-8 mt-2 text-4xl sm:text-5xl">{title}</h2>
      {children}
    </section>
  );
}
