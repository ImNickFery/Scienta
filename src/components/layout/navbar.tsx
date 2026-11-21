"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Search,
  Bookmark,
  ChevronDown,
  Hash,
  Users,
  ArrowUpLeft,
  ArrowUpRight,
} from "lucide-react";
import { BrandMark } from "./brand-mark";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";
import { isNavLinkActive } from "@/lib/navigation";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/command-palette";
import { BOOKMARKS_CHANGED_EVENT, getBookmarkedArticles } from "@/lib/article-bookmarks";
import { getBookmarkedEquationKeys } from "@/lib/equation-bookmarks";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";
import { isUnslopStyle, type DesignMode } from "@/lib/site-modes";

export function Navbar({
  locale,
  dict,
  fields,
  designMode = "classic",
}: {
  locale: Locale;
  dict: Dictionary;
  fields: FieldRecord[];
  designMode?: DesignMode;
}) {
  const isUnslop = isUnslopStyle(designMode);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const pathname = usePathname();
  const fieldsMenuRef = useRef<HTMLDivElement>(null);

  const isFa = locale === "fa";
  const CornerArrow = isFa ? ArrowUpLeft : ArrowUpRight;

  const openCommandPalette = () => {
    setFieldsOpen(false);
    setMobileOpen(false);
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const syncSaved = () => {
      setSavedCount(getBookmarkedArticles().length + getBookmarkedEquationKeys().length);
    };
    syncSaved();
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, syncSaved);
    window.addEventListener("storage", syncSaved);
    return () => {
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, syncSaved);
      window.removeEventListener("storage", syncSaved);
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closes transient navigation menus on route change
    setMobileOpen(false);
    setFieldsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!fieldsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) {
        setFieldsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFieldsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fieldsOpen]);

  const fieldsActive =
    isNavLinkActive(pathname, `/${locale}/fields`) ||
    isNavLinkActive(pathname, `/${locale}/tags`) ||
    isNavLinkActive(pathname, `/${locale}/authors`);

  return (
    <>
      <header
        className={cn(
          "safe-top sticky top-0 z-50 border-b transition-[background-color,border-color] duration-200",
          isUnslop
            ? scrolled
              ? "border-(--color-border-strong) bg-(--color-bg-deep)/95 backdrop-blur-sm"
              : "border-(--color-border-subtle) bg-(--color-bg-deep)/95"
            : scrolled
              ? "glass-panel border-(--color-border-subtle) shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)]"
              : "border-transparent bg-(--color-bg-deep)/60 backdrop-blur-md"
        )}
      >
        <nav
          aria-label={isFa ? "ناوبری اصلی" : "Main navigation"}
          className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:h-16 lg:gap-8 lg:px-10"
        >
          {/* Zone 1: Brand wordmark */}
          <BrandMark locale={locale} designMode={designMode} />

          {/* Zone 2: Clean single-line desktop nav links */}
          <div className="hidden items-center gap-1 lg:flex">
            <DesktopNavLink
              href={`/${locale}/articles`}
              label={dict.nav.articles}
              active={isNavLinkActive(pathname, `/${locale}/articles`)}
              isUnslop={isUnslop}
            />

            {/* Scientific Fields + Discovery dropdown */}
            <div ref={fieldsMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setFieldsOpen((v) => !v)}
                aria-expanded={fieldsOpen}
                aria-haspopup="menu"
                className={cn(
                  "group relative flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-sm font-medium transition-colors",
                  fieldsActive || fieldsOpen
                    ? "text-(--color-text-primary)"
                    : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                )}
              >
                <span>{dict.nav.fields}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 opacity-70 transition-transform duration-200",
                    fieldsOpen && "rotate-180 opacity-100"
                  )}
                />
                <span
                  className={cn(
                    "absolute inset-x-3.5 bottom-0 h-px origin-center scale-x-0 transition-transform duration-200 group-hover:scale-x-100",
                    isUnslop
                      ? "bg-(--color-text-primary)"
                      : "bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange)",
                    (fieldsActive || fieldsOpen) && "scale-x-100"
                  )}
                />
              </button>

              {fieldsOpen && (
                <div
                  role="menu"
                  aria-label={dict.nav.fields}
                  className={cn(
                    "absolute start-0 top-full z-50 mt-3 w-[440px] border border-(--color-border-strong) p-4",
                    isUnslop
                      ? "rounded-xl bg-(--color-bg-elevated) shadow-[0_12px_32px_rgba(24,22,19,0.1)]"
                      : "rounded-2xl bg-(--color-bg-elevated)/98 shadow-2xl backdrop-blur-xl"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-(--color-text-tertiary)">
                      {dict.nav.fields}
                    </span>
                    <Link
                      href={`/${locale}/fields`}
                      onClick={() => setFieldsOpen(false)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-purple) hover:underline"
                    >
                      <span>{dict.sections.viewAll}</span>
                      <CornerArrow className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {fields.slice(0, 10).map((f) => {
                      const href = `/${locale}/fields/${f.slug}`;
                      const active = isNavLinkActive(pathname, href);
                      return (
                        <Link
                          key={f.slug}
                          href={href}
                          role="menuitem"
                          onClick={() => setFieldsOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-(--color-accent-purple)/15 font-medium text-(--color-text-primary)"
                              : "text-(--color-text-secondary) hover:bg-white/[0.06] hover:text-(--color-text-primary)"
                          )}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-xs"
                            style={{ backgroundColor: f.color }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{f.name[locale]}</span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-(--color-border-subtle) pt-3">
                    <Link
                      href={`/${locale}/tags`}
                      role="menuitem"
                      onClick={() => setFieldsOpen(false)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-(--color-border-subtle) bg-black/20 px-3 py-2 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                    >
                      <Hash className="h-3.5 w-3.5 text-(--color-accent-purple)" />
                      <span>{isFa ? "همه برچسب‌ها" : "All Tags"}</span>
                    </Link>
                    <Link
                      href={`/${locale}/authors`}
                      role="menuitem"
                      onClick={() => setFieldsOpen(false)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-(--color-border-subtle) bg-black/20 px-3 py-2 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                    >
                      <Users className="h-3.5 w-3.5 text-(--color-accent-orange)" />
                      <span>{isFa ? "نویسندگان" : "Authors"}</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <DesktopNavLink
              href={`/${locale}/categories`}
              label={dict.nav.categories}
              active={isNavLinkActive(pathname, `/${locale}/categories`)}
              isUnslop={isUnslop}
            />
            <DesktopNavLink
              href={`/${locale}/about`}
              label={dict.nav.about}
              active={isNavLinkActive(pathname, `/${locale}/about`)}
              isUnslop={isUnslop}
            />
            <DesktopNavLink
              href={`/${locale}/contact`}
              label={dict.nav.contact}
              active={isNavLinkActive(pathname, `/${locale}/contact`)}
              isUnslop={isUnslop}
            />
          </div>

          {/* Zone 3: Utility controls & Mobile Drawer trigger */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href={`/${locale}/saved`}
              aria-label={isFa ? "مقالات و معادلات ذخیره‌شده" : "Saved library"}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center border transition-colors lg:h-9 lg:w-9",
                isUnslop ? "rounded-lg bg-(--color-bg-elevated)" : "rounded-full lg:h-10 lg:w-10",
                isNavLinkActive(pathname, `/${locale}/saved`)
                  ? "border-(--color-accent-orange)/60 bg-(--color-accent-orange)/10 text-(--color-accent-orange)"
                  : "border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
              )}
            >
              <Bookmark className="h-4 w-4" strokeWidth={1.5} />
              {savedCount > 0 && (
                <span
                  dir="ltr"
                  className={cn(
                    "absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1 font-[family-name:var(--font-mono)] text-[10px] font-semibold tabular-nums",
                    isUnslop
                      ? "rounded bg-(--color-text-primary) text-(--color-bg-elevated)"
                      : "rounded-full bg-(--color-accent-orange) font-bold text-black"
                  )}
                >
                  {savedCount > 99 ? "99+" : savedCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={openCommandPalette}
              aria-label={isFa ? "جستجوی سریع (Ctrl+K)" : "Quick search (Ctrl+K)"}
              className={cn(
                "flex h-11 w-11 items-center justify-center border transition-colors lg:w-auto lg:gap-2 lg:px-3",
                isUnslop
                  ? "rounded-lg bg-(--color-bg-elevated) lg:h-9"
                  : "rounded-full lg:h-10 lg:px-3.5",
                isNavLinkActive(pathname, `/${locale}/search`)
                  ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/10 text-(--color-accent-purple)"
                  : "border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
              )}
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="hidden whitespace-nowrap text-xs font-medium lg:inline">
                {dict.nav.search}
              </span>
              <kbd
                dir="ltr"
                className="hidden rounded border border-(--color-border-subtle) bg-white/[0.04] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary) lg:inline"
              >
                ⌘K
              </kbd>
            </button>

            <div className="hidden lg:block">
              <LanguageSwitcher currentLocale={locale} />
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? (isFa ? "بستن منو" : "Close menu") : (isFa ? "باز کردن منو" : "Open menu")}
              aria-expanded={mobileOpen}
              className={cn(
                "flex h-11 w-11 items-center justify-center border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) lg:hidden",
                isUnslop ? "rounded-lg bg-(--color-bg-elevated)" : "rounded-full"
              )}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </header>

      <MobileNavDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        locale={locale}
        dict={dict}
        fields={fields}
        pathname={pathname}
        savedCount={savedCount}
      />

      <CommandPalette locale={locale} fields={fields} />
    </>
  );
}

function DesktopNavLink({
  href,
  label,
  active,
  isUnslop = false,
}: {
  href: string;
  label: string;
  active: boolean;
  isUnslop?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative whitespace-nowrap px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "text-(--color-text-primary)"
          : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
      )}
    >
      {label}
      <span
        className={cn(
          "absolute inset-x-3.5 bottom-0 h-px origin-center scale-x-0 transition-transform duration-200 group-hover:scale-x-100",
          isUnslop
            ? "bg-(--color-text-primary)"
            : "bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange)",
          active && "scale-x-100"
        )}
      />
    </Link>
  );
}
