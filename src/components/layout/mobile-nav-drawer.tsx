"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X,
  Search,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Compass,
  Hash,
  Users,
  BookOpen,
  FolderKanban,
  Info,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSearchHref, isNavLinkActive } from "@/lib/navigation";
import { BrandMark } from "./brand-mark";
import { MobileLanguageControls } from "./language-switcher";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";
import { isUnslopStyle, type DesignMode } from "@/lib/site-modes";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  dict: Dictionary;
  fields: FieldRecord[];
  pathname: string | null;
  savedCount: number;
  designMode?: DesignMode;
}

export function MobileNavDrawer({
  open,
  onClose,
  locale,
  dict,
  fields,
  pathname,
  savedCount,
  designMode = "classic",
}: MobileNavDrawerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const reducedMotion = useReducedMotion();
  const isFa = locale === "fa";
  const isUnslop = isUnslopStyle(designMode);
  const ArrowChevron = isFa ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const primaryLinks = [
    { href: `/${locale}/articles`, label: dict.nav.articles, Icon: BookOpen },
    { href: `/${locale}/fields`, label: dict.nav.fields, Icon: Compass },
    { href: `/${locale}/categories`, label: dict.nav.categories, Icon: FolderKanban },
    { href: `/${locale}/tags`, label: isFa ? "برچسب‌ها" : "Tags", Icon: Hash },
    { href: `/${locale}/authors`, label: isFa ? "نویسندگان" : "Authors", Icon: Users },
    {
      href: `/${locale}/saved`,
      label: isFa ? "کتابخانه ذخیره‌شده" : "Saved Library",
      Icon: Bookmark,
      badge: savedCount > 0 ? (savedCount > 99 ? "99+" : String(savedCount)) : undefined,
    },
    { href: `/${locale}/about`, label: dict.nav.about, Icon: Info },
    { href: `/${locale}/contact`, label: dict.nav.contact, Icon: Mail },
  ];

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = buildSearchHref(locale, query);
    onClose();
    setQuery("");
    router.push(target);
  }

  const slideOffset = isFa ? 320 : -320;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[70] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={isFa ? "منوی ناوبری موبایل" : "Mobile navigation menu"}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.05 : 0.18 }}
            className="absolute inset-0 bg-black/65 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-over drawer anchored to logical start */}
          <motion.aside
            initial={reducedMotion ? { opacity: 0 } : { x: slideOffset, opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { x: slideOffset, opacity: 0.85 }}
            transition={
              reducedMotion
                ? { duration: 0.05 }
                : { type: "spring", stiffness: 420, damping: 38, mass: 0.85 }
            }
            className="safe-top safe-bottom relative flex h-dvh w-[min(88vw,360px)] flex-col border-e border-(--color-border-strong) bg-(--color-bg-deep) shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--color-border-subtle) px-4">
              <BrandMark locale={locale} designMode={designMode} onClick={onClose} />

              <button
                type="button"
                onClick={onClose}
                aria-label={isFa ? "بستن منو" : "Close menu"}
                className={cn(
                  "flex h-11 w-11 items-center justify-center border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)",
                  isUnslop ? "rounded-lg bg-(--color-bg-elevated)" : "rounded-full"
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
              {/* Quick Search */}
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isFa ? "جستجوی مقاله، فرمول یا حوزه…" : "Search articles, topics…"}
                  aria-label={dict.nav.search}
                  className={cn(
                    "h-11 w-full border border-(--color-border-strong) bg-(--color-bg-secondary) ps-10 pe-4 text-sm text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)",
                    isUnslop ? "rounded-lg" : "rounded-xl"
                  )}
                />
              </form>

              {/* Primary Navigation */}
              <nav aria-label={isFa ? "بخش‌های اصلی" : "Primary navigation"} className="space-y-1">
                {primaryLinks.map(({ href, label, Icon, badge }) => {
                  const active = isNavLinkActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        "flex min-h-[44px] items-center justify-between px-3.5 text-sm font-medium transition-colors",
                        isUnslop ? "rounded-lg" : "rounded-xl",
                        active
                          ? "bg-(--color-accent-purple)/12 text-(--color-text-primary)"
                          : "text-(--color-text-secondary) hover:bg-(--color-bg-secondary) hover:text-(--color-text-primary)"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-(--color-accent-purple)" : "text-(--color-text-tertiary)"
                          )}
                          strokeWidth={1.6}
                        />
                        <span>{label}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {badge && (
                          <span
                            dir="ltr"
                            className="rounded bg-(--color-accent-purple)/15 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold tabular-nums text-(--color-accent-purple)"
                          >
                            {badge}
                          </span>
                        )}
                        <ArrowChevron className="h-4 w-4 text-(--color-text-tertiary) opacity-60" />
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {/* All 10 Scientific Fields Quick Grid */}
              {fields.length > 0 && (
                <div className="border-t border-(--color-border-subtle) pt-4">
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold text-(--color-text-tertiary)">{dict.nav.fields}</p>
                    <Link
                      href={`/${locale}/fields`}
                      onClick={onClose}
                      className="text-xs font-medium text-(--color-accent-purple) hover:underline"
                    >
                      {dict.sections.viewAll}
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {fields.map((field) => {
                      const href = `/${locale}/fields/${field.slug}`;
                      const active = isNavLinkActive(pathname, href);
                      return (
                        <Link
                          key={field.slug}
                          href={href}
                          onClick={onClose}
                          className={cn(
                            "flex min-h-[42px] items-center gap-2 border px-3 text-xs font-medium transition-colors",
                            isUnslop ? "rounded-lg" : "rounded-xl",
                            active
                              ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/12 text-(--color-text-primary)"
                              : "border-(--color-border-subtle) bg-(--color-bg-secondary)/70 text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                          )}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: field.color }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{field.name[locale]}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Pinned Drawer Footer: Language & Numerals always immediately reachable */}
            <div className="shrink-0 border-t border-(--color-border-subtle) bg-(--color-bg-secondary)/80 px-4 py-3">
              <MobileLanguageControls currentLocale={locale} onSelect={onClose} />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
