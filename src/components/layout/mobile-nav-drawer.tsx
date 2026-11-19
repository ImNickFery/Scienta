"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Search,
  Sparkles,
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
import { MobileLanguageControls } from "./language-switcher";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  dict: Dictionary;
  fields: FieldRecord[];
  pathname: string | null;
  savedCount: number;
}

export function MobileNavDrawer({
  open,
  onClose,
  locale,
  dict,
  fields,
  pathname,
  savedCount,
}: MobileNavDrawerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const isFa = locale === "fa";
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

  if (!open) return null;

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

  return (
    <div
      className="fixed inset-0 z-[70] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={isFa ? "منوی ناوبری موبایل" : "Mobile navigation menu"}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over drawer anchored to logical start (right in RTL Persian, left in LTR English) */}
      <aside className="safe-top safe-bottom relative flex h-dvh w-[min(88vw,360px)] flex-col border-e border-(--color-border-strong) bg-(--color-bg-deep)/98 shadow-2xl backdrop-blur-xl">
        {/* Drawer Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--color-border-subtle) px-4">
          <Link
            href={`/${locale}`}
            onClick={onClose}
            className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-bold"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-red)">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="text-gradient-aurora">Scienta</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label={isFa ? "بستن منو" : "Close menu"}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
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
              className="h-11 w-full rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) ps-10 pe-4 text-sm text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
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
                    "flex min-h-[46px] items-center justify-between rounded-xl px-3.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-(--color-accent-purple)/15 text-(--color-text-primary)"
                      : "text-(--color-text-secondary) hover:bg-white/[0.05] hover:text-(--color-text-primary)"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-(--color-accent-purple)" : "text-(--color-text-tertiary)"
                      )}
                    />
                    <span>{label}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {badge && (
                      <span
                        dir="ltr"
                        className="rounded-md bg-(--color-accent-orange)/20 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold tabular-nums text-(--color-accent-orange)"
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

          {/* Scientific Fields Quick Grid */}
          {fields.length > 0 && (
            <div className="border-t border-(--color-border-subtle) pt-4">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-(--color-text-tertiary)">{dict.nav.fields}</p>
                <Link
                  href={`/${locale}/fields`}
                  onClick={onClose}
                  className="text-xs text-(--color-accent-purple) hover:underline"
                >
                  {dict.sections.viewAll}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {fields.slice(0, 8).map((field) => {
                  const href = `/${locale}/fields/${field.slug}`;
                  const active = isNavLinkActive(pathname, href);
                  return (
                    <Link
                      key={field.slug}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors",
                        active
                          ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/15 text-(--color-text-primary)"
                          : "border-(--color-border-subtle) bg-(--color-bg-secondary)/60 text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      )}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-xs"
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
      </aside>
    </div>
  );
}
