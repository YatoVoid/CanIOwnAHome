"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { photoAt } from "@/lib/format";

export function Gallery({ photos, address }: { photos: string[]; address: string }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;

  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length);

  return (
    <div
      className="min-w-0 space-y-3"
      role="region"
      aria-roledescription="carousel"
      aria-label={`Photos of ${address}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-sunk">
        <Image
          key={photos[index]}
          src={photoAt(photos[index], "full")}
          alt={`Photo ${index + 1} of ${photos.length}, ${address}`}
          fill
          unoptimized
          sizes="(min-width: 1152px) 1100px, 100vw"
          className="object-cover"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-navy/80 text-on-navy hover:bg-navy"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-navy/80 text-on-navy hover:bg-navy"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded bg-navy/80 px-2 py-0.5 text-xs tabular-nums text-on-navy">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`relative block h-16 w-24 overflow-hidden rounded-md ${
                  i === index ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : "opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={photoAt(src, "card")} alt="" fill unoptimized sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
