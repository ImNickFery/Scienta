"use client";

import { useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { sanitizeUrl } from "@/lib/security";
import { SciIllustration } from "./sci-illustration";

interface FigureProps {
  src?: string;
  illustration?: "orbit" | "nebula" | "circuit" | "wave" | "molecule" | "field-lines";
  palette?: "purple" | "orange" | "red" | "aurora";
  alt: string;
  caption?: string;
  credit?: string;
  wide?: boolean;
  aspect?: "video" | "square" | "portrait" | "wide";
}

const ASPECT_CLASSES: Record<string, string> = {
  video: "aspect-video",
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  wide: "aspect-[21/9]",
};

export function Figure({ src, illustration = "orbit", palette = "aurora", alt, caption, credit, wide, aspect = "video" }: FigureProps) {
  const [open, setOpen] = useState(false);
  const safeSrc = sanitizeUrl(src, { allowRelative: true, allowHash: false });

  return (
    <figure className={wide ? "-mx-6 sm:-mx-12 lg:-mx-24" : ""}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block w-full overflow-hidden rounded-2xl border border-(--color-border-subtle) ${ASPECT_CLASSES[aspect]}`}
        aria-label={`Zoom image: ${alt}`}
      >
        {safeSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeSrc} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full transition-transform duration-700 group-hover:scale-105">
            <SciIllustration variant={illustration} palette={palette} className="h-full w-full" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black">
            <ZoomIn className="h-4 w-4" />
          </span>
        </div>
      </button>
      {(caption || credit) && (
        <figcaption>
          {caption}
          {credit && <span className="block text-[0.8em] opacity-70">{credit}</span>}
        </figcaption>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overscroll-contain bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute end-6 safe-top-offset flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-h-[85vh] max-w-5xl overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
            {safeSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={safeSrc} alt={alt} referrerPolicy="no-referrer" className="max-h-[85vh] w-auto object-contain" />
            ) : (
              <SciIllustration variant={illustration} palette={palette} className="max-h-[85vh] w-full max-w-3xl" />
            )}
          </div>
          {caption && <p className="absolute bottom-6 start-1/2 max-w-lg -translate-x-1/2 text-center text-sm text-white/70 rtl:translate-x-1/2">{caption}</p>}
        </div>
      )}
    </figure>
  );
}
