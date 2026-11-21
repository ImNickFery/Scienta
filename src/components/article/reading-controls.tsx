"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Minus, Plus, Focus, Minimize2, RotateCcw, Columns3 } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import {
  DEFAULT_READING_PREFS,
  FONT_SCALES,
  READING_PREFS_EVENT,
  READING_PREFS_STORAGE_KEY,
  WIDTH_CSS_VALUES,
  WIDTH_PRESETS,
  clampFontIndex,
  formatFontPercent,
  getFontScale,
  isDefaultReadingPrefs,
  parseStoredReadingPrefs,
  serializeReadingPrefs,
  type ReadingWidthPreset,
  type StoredReadingPreferences,
} from "@/lib/reading-preferences";

let cachedRaw: string | null = null;
let cachedParsed: StoredReadingPreferences = DEFAULT_READING_PREFS;

function getClientSnapshot(): StoredReadingPreferences {
  if (typeof window === "undefined") return DEFAULT_READING_PREFS;
  try {
    const raw = window.localStorage.getItem(READING_PREFS_STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedParsed = parseStoredReadingPrefs(raw);
    }
    return cachedParsed;
  } catch {
    return DEFAULT_READING_PREFS;
  }
}

function getServerSnapshot(): StoredReadingPreferences {
  return DEFAULT_READING_PREFS;
}

function subscribeToReadingPrefs(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(READING_PREFS_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(READING_PREFS_EVENT, handler);
  };
}

function writeReadingPrefs(next: StoredReadingPreferences) {
  if (typeof window === "undefined") return;
  try {
    const serialized = serializeReadingPrefs(next);
    window.localStorage.setItem(READING_PREFS_STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedParsed = parseStoredReadingPrefs(serialized);
    window.dispatchEvent(new Event(READING_PREFS_EVENT));
  } catch {
    // Ignore storage quota / private mode failures
  }
}

const WIDTH_LABELS: Record<Locale, Record<ReadingWidthPreset, string>> = {
  fa: {
    narrow: "باریک",
    standard: "استاندارد",
    wide: "عریض",
  },
  en: {
    narrow: "Narrow",
    standard: "Normal",
    wide: "Wide",
  },
};

export function ReadingControls({
  children,
  dict,
  locale,
}: {
  children: React.ReactNode;
  dict: Dictionary;
  locale: Locale;
}) {
  const prefs = useSyncExternalStore(
    subscribeToReadingPrefs,
    getClientSnapshot,
    getServerSnapshot
  );
  const [focusMode, setFocusMode] = useState(false);

  const isFa = locale === "fa";

  const updatePrefs = useCallback(
    (updater: (current: StoredReadingPreferences) => StoredReadingPreferences) => {
      const next = updater(getClientSnapshot());
      writeReadingPrefs(next);
    },
    []
  );

  const decreaseFont = useCallback(() => {
    updatePrefs((cur) => ({ ...cur, fontIndex: clampFontIndex(cur.fontIndex - 1) }));
  }, [updatePrefs]);

  const increaseFont = useCallback(() => {
    updatePrefs((cur) => ({ ...cur, fontIndex: clampFontIndex(cur.fontIndex + 1) }));
  }, [updatePrefs]);

  const setWidth = useCallback(
    (width: ReadingWidthPreset) => {
      updatePrefs((cur) => ({ ...cur, width }));
    },
    [updatePrefs]
  );

  const resetPrefs = useCallback(() => {
    writeReadingPrefs(DEFAULT_READING_PREFS);
  }, []);

  useEffect(() => {
    if (focusMode) {
      document.documentElement.dataset.articleFocus = "true";
    } else {
      delete document.documentElement.dataset.articleFocus;
    }
    return () => {
      delete document.documentElement.dataset.articleFocus;
    };
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  const fontScale = getFontScale(prefs.fontIndex);
  const clampedMaxWidth = `min(100%, ${WIDTH_CSS_VALUES[prefs.width]})`;
  const toolbarMaxWidth = `min(100%, ${prefs.width === "narrow" ? "42rem" : WIDTH_CSS_VALUES[prefs.width]})`;
  const atMinFont = prefs.fontIndex <= 0;
  const atMaxFont = prefs.fontIndex >= FONT_SCALES.length - 1;
  const modified = !isDefaultReadingPrefs(prefs);

  return (
    <div className="min-w-0 w-full">
      <div
        role="toolbar"
        aria-label={isFa ? "تنظیمات مطالعه مقاله" : "Article reading controls"}
        data-reading-width={prefs.width}
        data-reading-scale={fontScale}
        className={`reading-controls-bar mx-auto mb-8 flex w-full flex-wrap items-center gap-2 transition-all duration-300 print:hidden ${
          focusMode
            ? "sticky top-4 z-40 justify-center rounded-2xl border border-(--color-border-strong) bg-(--color-bg-secondary)/90 p-2 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl"
            : ""
        }`}
        style={{ maxWidth: toolbarMaxWidth }}
      >
        {/* Font size stepper */}
        <div
          className="glass-panel flex h-10 items-center gap-1 rounded-full px-1.5"
          aria-label={dict.article.fontSize}
        >
          <button
            type="button"
            aria-label={isFa ? "کوچک‌تر کردن اندازه فونت" : "Decrease font size"}
            disabled={atMinFont}
            onClick={decreaseFont}
            className="flex h-7 w-7 items-center justify-center rounded-full text-(--color-text-secondary) transition-colors hover:bg-white/10 hover:text-(--color-text-primary) disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span
            className="min-w-[3.1rem] text-center font-[family-name:var(--font-mono)] text-xs font-medium text-(--color-text-primary)"
            title={dict.article.fontSize}
          >
            {formatFontPercent(prefs.fontIndex, locale)}
          </span>
          <button
            type="button"
            aria-label={isFa ? "بزرگ‌تر کردن اندازه فونت" : "Increase font size"}
            disabled={atMaxFont}
            onClick={increaseFont}
            className="flex h-7 w-7 items-center justify-center rounded-full text-(--color-text-secondary) transition-colors hover:bg-white/10 hover:text-(--color-text-primary) disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Reading width segmented selector (desktop/tablet where column width applies) */}
        <div
          className="glass-panel hidden h-10 items-center gap-1 rounded-full p-1 md:flex"
          role="group"
          aria-label={dict.article.readingWidth}
        >
          <span className="hidden items-center gap-1 ps-2 pe-1 text-[11px] text-(--color-text-tertiary) sm:inline-flex">
            <Columns3 className="h-3.5 w-3.5" />
            {dict.article.readingWidth}
          </span>
          {WIDTH_PRESETS.map((preset) => {
            const active = prefs.width === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => setWidth(preset)}
                className={`h-8 rounded-full px-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-secondary) hover:bg-white/10 hover:text-(--color-text-primary)"
                }`}
              >
                {WIDTH_LABELS[locale][preset]}
              </button>
            );
          })}
        </div>

        {/* Focus mode toggle */}
        <button
          type="button"
          aria-pressed={focusMode}
          onClick={() => setFocusMode((v) => !v)}
          className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-all ${
            focusMode
              ? "border-(--color-accent-orange)/60 bg-(--color-accent-orange)/15 text-(--color-accent-orange)"
              : "glass-panel border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          }`}
        >
          {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Focus className="h-3.5 w-3.5" />}
          <span>
            {focusMode
              ? isFa
                ? "خروج از تمرکز"
                : "Exit focus"
              : dict.article.focusMode}
          </span>
          {focusMode && (
            <kbd className="hidden rounded border border-(--color-accent-orange)/40 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] sm:inline">
              Esc
            </kbd>
          )}
        </button>

        {/* Quick reset when font or width customized */}
        {modified && (
          <button
            type="button"
            onClick={resetPrefs}
            aria-label={isFa ? "بازنشانی تنظیمات مطالعه" : "Reset reading settings"}
            title={isFa ? "بازنشانی تنظیمات مطالعه" : "Reset reading settings"}
            className="glass-panel flex h-10 items-center gap-1.5 rounded-full px-3 text-xs text-(--color-text-tertiary) transition-colors hover:text-(--color-text-primary)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isFa ? "بازنشانی" : "Reset"}</span>
          </button>
        )}
      </div>

      <article
        className="prose-scientific mx-auto w-full min-w-0 transition-[max-width,font-size] duration-300"
        data-reading-width={prefs.width}
        style={
          {
            "--reading-font-scale": String(fontScale),
            maxWidth: clampedMaxWidth,
          } as React.CSSProperties
        }
      >
        {children}
      </article>
    </div>
  );
}
