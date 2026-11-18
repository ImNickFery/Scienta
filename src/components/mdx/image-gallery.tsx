"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { SciIllustration } from "./sci-illustration";

interface GalleryImage {
  src?: string;
  illustration?: "orbit" | "nebula" | "circuit" | "wave" | "molecule" | "field-lines";
  palette?: "purple" | "orange" | "red" | "aurora";
  alt: string;
  caption?: string;
}

export function ImageGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const next = () => setActiveIndex((i) => (i === null ? null : (i + 1) % images.length));
  const prev = () => setActiveIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length));

  return (
    <div className="not-prose my-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-(--color-border-subtle)"
          >
            {img.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.src} alt={img.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
            ) : (
              <SciIllustration variant={img.illustration ?? "nebula"} palette={img.palette ?? "aurora"} className="h-full w-full transition-transform duration-500 group-hover:scale-110" />
            )}
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overscroll-contain bg-black/90 p-4 backdrop-blur-sm" onClick={() => setActiveIndex(null)}>
          <button onClick={() => setActiveIndex(null)} aria-label="Close" className="absolute end-6 safe-top-offset flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous image"
            className="absolute start-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 rtl:rotate-180"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="max-h-[80vh] max-w-4xl overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
            {images[activeIndex].src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[activeIndex].src} alt={images[activeIndex].alt} className="max-h-[80vh] w-auto object-contain" />
            ) : (
              <SciIllustration variant={images[activeIndex].illustration ?? "nebula"} palette={images[activeIndex].palette ?? "aurora"} className="max-h-[80vh] w-full max-w-2xl" />
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next image"
            className="absolute end-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 rtl:rotate-180"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          {images[activeIndex].caption && (
            <p className="absolute bottom-6 start-1/2 max-w-lg -translate-x-1/2 text-center text-sm text-white/70 rtl:translate-x-1/2">
              {images[activeIndex].caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
