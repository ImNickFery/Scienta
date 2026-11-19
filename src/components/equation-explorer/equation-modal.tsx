"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import katex from "katex";
import {
  X, ZoomIn, ZoomOut, Maximize, Minimize, Copy, Check, Link2,
  Bookmark, BookmarkCheck, Hash,
} from "lucide-react";
import { extractKnownSymbols } from "@/lib/equation-parser";
import { exportKatexElementToSvg } from "@/lib/equation-svg-export";
import { equationKey, isEquationBookmarked, toggleEquationBookmark } from "@/lib/equation-bookmarks";
import { copyToClipboard } from "@/lib/clipboard";
import type { Locale } from "@/lib/i18n/config";
import type { SymbolDefinition } from "@/lib/equation-glossary";

interface EquationModalProps {
  latex: string;
  equationId: string;
  index: number;
  articleSlug: string;
  articleTitle?: string;
  locale: Locale;
  onClose: () => void;
}

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3];

const STRINGS = {
  fa: {
    equation: "معادله",
    zoomIn: "بزرگ‌نمایی",
    zoomOut: "کوچک‌نمایی",
    fullscreen: "تمام‌صفحه",
    exitFullscreen: "خروج از تمام‌صفحه",
    copyLatex: "کپی LaTeX",
    copySvg: "کپی SVG",
    copyLink: "کپی پیوند",
    copied: "کپی شد",
    bookmark: "نشان کردن",
    bookmarked: "نشان‌شده",
    variables: "متغیرها",
    noVariables: "نمادی از واژه‌نامه در این معادله شناسایی نشد.",
    unit: "واحد",
    relatedField: "حوزه مرتبط",
    close: "بستن",
  },
  en: {
    equation: "Equation",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    copyLatex: "Copy LaTeX",
    copySvg: "Copy SVG",
    copyLink: "Copy link",
    copied: "Copied",
    bookmark: "Bookmark",
    bookmarked: "Bookmarked",
    variables: "Variables",
    noVariables: "No glossary-recognized symbols in this equation.",
    unit: "Unit",
    relatedField: "Related field",
    close: "Close",
  },
};

function VariableRow({ symbol, locale }: { symbol: SymbolDefinition; locale: Locale }) {
  const symbolHtml = katex.renderToString(symbol.tokens[0].replace(/^\|/, "").replace(/\\rangle$/, ""), {
    throwOnError: false,
    displayMode: false,
    trust: false,
    maxExpand: 100,
    maxSize: 10,
  });
  const t = STRINGS[locale];

  return (
    <div className="rounded-xl border border-(--color-border-subtle) bg-white/[0.02] p-4">
      <div className="mb-1.5 flex items-center gap-3">
        <span
          className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-(--color-accent-purple)/15 px-2 text-(--color-accent-purple)"
          dir="ltr"
          dangerouslySetInnerHTML={{ __html: symbolHtml }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-(--color-text-primary)">{symbol.name[locale]}</p>
          {symbol.unit && (
            <p className="text-xs text-(--color-text-tertiary)">
              {t.unit}: <span dir="ltr">{symbol.unit[locale]}</span>
            </p>
          )}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-(--color-text-tertiary)">{symbol.description[locale]}</p>
      {symbol.relatedField && (
        <Link
          href={`/${locale}${symbol.relatedField}`}
          className="mt-2 inline-block text-xs text-(--color-accent-orange) hover:underline"
        >
          {t.relatedField} →
        </Link>
      )}
    </div>
  );
}

export function EquationModal({ latex, equationId, index, articleSlug, articleTitle, locale, onClose }: EquationModalProps) {
  const t = STRINGS[locale];
  const containerRef = useRef<HTMLDivElement>(null);
  const katexHostRef = useRef<HTMLDivElement>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [renderError, setRenderError] = useState(false);

  const bookmarkKey = equationKey(articleSlug, equationId);
  const symbols = extractKnownSymbols(latex);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser feature support + persisted bookmark state once on mount
    setFullscreenSupported(typeof document !== "undefined" && document.fullscreenEnabled);
    setBookmarked(isEquationBookmarked(bookmarkKey));
  }, [bookmarkKey]);

  useEffect(() => {
    if (!katexHostRef.current) return;
    try {
      katex.render(latex.slice(0, 4000), katexHostRef.current, {
        throwOnError: false,
        displayMode: true,
        output: "htmlAndMathml",
        trust: false,
        maxExpand: 300,
        maxSize: 15,
      });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surfaces a render failure from an external library call, not derived render state
      setRenderError(true);
    }
  }, [latex]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const flashCopied = useCallback((action: string) => {
    setCopiedAction(action);
    setTimeout(() => setCopiedAction((current) => (current === action ? null : current)), 1600);
  }, []);

  async function handleCopyLatex() {
    if (await copyToClipboard(latex)) {
      flashCopied("latex");
    }
  }

  async function handleCopySvg() {
    const katexEl = katexHostRef.current?.querySelector(".katex") as HTMLElement | null;
    if (!katexEl) return;
    const svg = exportKatexElementToSvg(katexEl);
    if (!svg) return;
    // Copied as SVG markup (text), not a typed clipboard image — the async
    // Clipboard API's support for arbitrary MIME types like image/svg+xml
    // via ClipboardItem is inconsistent across Safari/Firefox/Chrome, while
    // plain text copy works everywhere. Paste into a .svg file or any
    // markup-aware editor.
    if (await copyToClipboard(svg)) {
      flashCopied("svg");
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${equationId}`;
    if (await copyToClipboard(url)) {
      flashCopied("link");
    }
  }

  function handleToggleBookmark() {
    setBookmarked(
      toggleEquationBookmark(bookmarkKey, {
        articleSlug,
        articleTitle,
        equationId,
        index,
        latex,
      })
    );
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen().catch(() => {});
    }
  }

  const svgExportSupported = typeof window !== "undefined" && typeof XMLSerializer !== "undefined";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overscroll-contain bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${t.equation} ${index}`}
    >
      <button
        onClick={onClose}
        aria-label={t.close}
        className="safe-top-offset absolute end-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-(--color-bg-elevated)"
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-(--color-border-subtle) px-5 py-3">
          <span className="me-auto flex items-center gap-1.5 text-xs text-(--color-text-tertiary)">
            <Hash className="h-3.5 w-3.5" />
            {t.equation} {index}
          </span>

          <ToolbarButton
            icon={ZoomOut}
            label={t.zoomOut}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
          />
          <ToolbarButton
            icon={ZoomIn}
            label={t.zoomIn}
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
          />
          {fullscreenSupported && (
            <ToolbarButton
              icon={isFullscreen ? Minimize : Maximize}
              label={isFullscreen ? t.exitFullscreen : t.fullscreen}
              onClick={toggleFullscreen}
            />
          )}
          <ToolbarButton
            icon={copiedAction === "latex" ? Check : Copy}
            label={t.copyLatex}
            onClick={handleCopyLatex}
          />
          {svgExportSupported && (
            <ToolbarButton
              icon={copiedAction === "svg" ? Check : Copy}
              label={t.copySvg}
              onClick={handleCopySvg}
            />
          )}
          <ToolbarButton
            icon={copiedAction === "link" ? Check : Link2}
            label={t.copyLink}
            onClick={handleCopyLink}
          />
          <ToolbarButton
            icon={bookmarked ? BookmarkCheck : Bookmark}
            label={bookmarked ? t.bookmarked : t.bookmark}
            onClick={handleToggleBookmark}
            active={bookmarked}
          />
        </div>

        {/* Equation viewport */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-10">
          {renderError ? (
            <p className="text-sm text-(--color-accent-red)">
              {locale === "fa" ? "خطا در رندر معادله." : "Failed to render this equation."}
            </p>
          ) : (
            <div
              ref={katexHostRef}
              dir="ltr"
              className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `scale(${ZOOM_STEPS[zoomIndex]})` }}
            />
          )}
        </div>

        {/* Variables panel */}
        <div className="max-h-64 overflow-y-auto border-t border-(--color-border-subtle) p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-(--color-text-tertiary)">
            {t.variables}
          </p>
          {symbols.length === 0 ? (
            <p className="text-sm text-(--color-text-tertiary)">{t.noVariables}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {symbols.map((symbol) => (
                <VariableRow key={symbol.name.en} symbol={symbol} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: typeof ZoomIn;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
        active ? "bg-(--color-accent-purple)/20 text-(--color-accent-purple)" : "text-(--color-text-tertiary) hover:bg-white/10 hover:text-(--color-text-primary)"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
