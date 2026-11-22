"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

type NavKey = "articles" | "fields" | "categories" | "about" | "contact";

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
  const isKinetic = designMode === "unslop-kinetic";
  const reducedMotion = useReducedMotion();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<NavKey | null>(null);
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
    const onScroll = () => setScrolled(window.scrollY > 14);
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
    setHoveredKey(null);
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

  const articlesActive = isNavLinkActive(pathname, `/${locale}/articles`);
  const fieldsActive =
    isNavLinkActive(pathname, `/${locale}/fields`) ||
    isNavLinkActive(pathname, `/${locale}/tags`) ||
    isNavLinkActive(pathname, `/${locale}/authors`);
  const categoriesActive = isNavLinkActive(pathname, `/${locale}/categories`);
  const aboutActive = isNavLinkActive(pathname, `/${locale}/about`);
  const contactActive = isNavLinkActive(pathname, `/${locale}/contact`);

  const hoverSpring = reducedMotion
    ? { duration: 0.05 }
    : { type: "spring" as const, stiffness: 480, damping: 36, mass: 0.7 };

  const activePlateKey: NavKey | null = hoveredKey ?? (fieldsOpen ? "fields" : null);
  const activeIndicatorKey: NavKey | null = fieldsOpen
    ? "fields"
    : articlesActive
      ? "articles"
      : fieldsActive
        ? "fields"
        : categoriesActive
          ? "categories"
          : aboutActive
            ? "about"
            : contactActive
              ? "contact"
              : null;

  return (
    <>
      <header
        data-scrolled={scrolled ? "true" : "false"}
        className={cn(
          "safe-top sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-200",
          isUnslop
            ? scrolled
              ? "border-(--color-border-strong) bg-(--color-bg-deep)/88 shadow-[0_8px_28px_-16px_rgba(0,0,0,0.32)] backdrop-blur-md"
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

          {/* Zone 2: Living desktop navigation links with magnetic spring glide */}
          <div
            className="hidden items-center gap-0.5 lg:flex"
            onMouseLeave={() => setHoveredKey(null)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setHoveredKey(null);
              }
            }}
          >
            <DesktopNavLink
              navKey="articles"
              href={`/${locale}/articles`}
              label={dict.nav.articles}
              active={articlesActive}
              showIndicator={activeIndicatorKey === "articles"}
              hovered={activePlateKey === "articles"}
              onHover={setHoveredKey}
              isUnslop={isUnslop}
              isKinetic={isKinetic}
              hoverSpring={hoverSpring}
            />

            {/* Scientific Fields + Discovery dropdown */}
            <div ref={fieldsMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setFieldsOpen((v) => !v)}
                onMouseEnter={() => setHoveredKey("fields")}
                onFocus={() => setHoveredKey("fields")}
                aria-expanded={fieldsOpen}
                aria-haspopup="menu"
                className={cn(
                  "group relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple)",
                  fieldsActive || fieldsOpen || activePlateKey === "fields"
                    ? "text-(--color-text-primary)"
                    : "text-(--color-text-secondary)"
                )}
              >
                {activePlateKey === "fields" && (
                  <motion.span
                    layoutId="navbar-hover-plate"
                    data-testid="nav-hover-plate"
                    transition={hoverSpring}
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0 z-0",
                      isUnslop
                        ? "rounded-lg bg-(--color-bg-secondary)"
                        : "rounded-full bg-(--color-bg-elevated)/80"
                    )}
                  />
                )}
                <span className="relative z-10">{dict.nav.fields}</span>
                <ChevronDown
                  className={cn(
                    "relative z-10 h-3.5 w-3.5 opacity-70 transition-transform duration-200",
                    fieldsOpen && "rotate-180 text-(--color-accent-purple) opacity-100"
                  )}
                  strokeWidth={1.75}
                />
                {activeIndicatorKey === "fields" && (
                  <motion.span
                    layoutId="navbar-active-indicator"
                    data-testid="nav-active-indicator"
                    transition={hoverSpring}
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-3.5 -bottom-[14px] h-[2px] rounded-full",
                      isKinetic
                        ? "bg-(--color-accent-purple)"
                        : isUnslop
                          ? "bg-(--color-text-primary)"
                          : "bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange)"
                    )}
                  />
                )}
              </button>

              <AnimatePresence>
                {fieldsOpen && (
                  <motion.div
                    role="menu"
                    aria-label={dict.nav.fields}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.985 }}
                    transition={
                      reducedMotion
                        ? { duration: 0.05 }
                        : { duration: 0.17, ease: [0.16, 1, 0.3, 1] }
                    }
                    className={cn(
                      "absolute start-0 top-full z-50 mt-4 w-[450px] border border-(--color-border-strong) p-4",
                      isUnslop
                        ? "rounded-xl bg-(--color-bg-elevated) shadow-[0_18px_44px_-16px_rgba(0,0,0,0.32)]"
                        : "rounded-2xl bg-(--color-bg-elevated)/98 shadow-2xl backdrop-blur-xl"
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-(--color-border-subtle) pb-2.5 px-1">
                      <span className="text-xs font-semibold text-(--color-text-tertiary)">
                        {dict.nav.fields}
                      </span>
                      <Link
                        href={`/${locale}/fields`}
                        onClick={() => setFieldsOpen(false)}
                        className="group/all inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-purple) hover:underline"
                      >
                        <span>{dict.sections.viewAll}</span>
                        <CornerArrow className="h-3.5 w-3.5 transition-transform duration-150 group-hover/all:-translate-y-0.5" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
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
                              "group/item flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150",
                              active
                                ? "bg-(--color-accent-purple)/12 font-medium text-(--color-text-primary)"
                                : "text-(--color-text-secondary) hover:bg-(--color-bg-secondary) hover:text-(--color-text-primary)"
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className="h-2 w-2 shrink-0 rounded-[2px] transition-transform duration-150 group-hover/item:scale-125"
                                style={{ backgroundColor: f.color }}
                                aria-hidden="true"
                              />
                              <span className="truncate">{f.name[locale]}</span>
                            </span>
                            <CornerArrow
                              className="h-3.5 w-3.5 shrink-0 text-(--color-accent-purple) opacity-0 transition-all duration-150 group-hover/item:opacity-100"
                              strokeWidth={1.75}
                            />
                          </Link>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center gap-2 border-t border-(--color-border-subtle) pt-3">
                      <Link
                        href={`/${locale}/tags`}
                        role="menuitem"
                        onClick={() => setFieldsOpen(false)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 py-2 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      >
                        <Hash className="h-3.5 w-3.5 text-(--color-accent-purple)" strokeWidth={1.75} />
                        <span>{isFa ? "همه برچسب‌ها" : "All Tags"}</span>
                      </Link>
                      <Link
                        href={`/${locale}/authors`}
                        role="menuitem"
                        onClick={() => setFieldsOpen(false)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 py-2 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                      >
                        <Users className="h-3.5 w-3.5 text-(--color-accent-purple)" strokeWidth={1.75} />
                        <span>{isFa ? "نویسندگان" : "Authors"}</span>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DesktopNavLink
              navKey="categories"
              href={`/${locale}/categories`}
              label={dict.nav.categories}
              active={categoriesActive}
              showIndicator={activeIndicatorKey === "categories"}
              hovered={activePlateKey === "categories"}
              onHover={setHoveredKey}
              isUnslop={isUnslop}
              isKinetic={isKinetic}
              hoverSpring={hoverSpring}
            />
            <DesktopNavLink
              navKey="about"
              href={`/${locale}/about`}
              label={dict.nav.about}
              active={aboutActive}
              showIndicator={activeIndicatorKey === "about"}
              hovered={activePlateKey === "about"}
              onHover={setHoveredKey}
              isUnslop={isUnslop}
              isKinetic={isKinetic}
              hoverSpring={hoverSpring}
            />
            <DesktopNavLink
              navKey="contact"
              href={`/${locale}/contact`}
              label={dict.nav.contact}
              active={contactActive}
              showIndicator={activeIndicatorKey === "contact"}
              hovered={activePlateKey === "contact"}
              onHover={setHoveredKey}
              isUnslop={isUnslop}
              isKinetic={isKinetic}
              hoverSpring={hoverSpring}
            />
          </div>

          {/* Zone 3: Tactile utility controls & Mobile Drawer trigger */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href={`/${locale}/saved`}
              aria-label={isFa ? "مقالات و معادلات ذخیره‌شده" : "Saved library"}
              className={cn(
                "group relative flex h-11 w-11 items-center justify-center border transition-[border-color,background-color,color,transform] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple) lg:h-9 lg:w-9",
                isUnslop ? "rounded-lg bg-(--color-bg-elevated)/70" : "rounded-full lg:h-10 lg:w-10",
                isNavLinkActive(pathname, `/${locale}/saved`)
                  ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/12 text-(--color-accent-purple)"
                  : "border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
              )}
            >
              <Bookmark
                className="h-4 w-4 transition-transform duration-150 group-hover:-translate-y-px"
                strokeWidth={1.6}
              />
              {savedCount > 0 && (
                <span
                  dir="ltr"
                  className={cn(
                    "absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1 font-[family-name:var(--font-mono)] text-[10px] font-semibold tabular-nums",
                    isUnslop
                      ? "rounded bg-(--color-accent-purple) text-white"
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
                "group flex h-11 w-11 items-center justify-center border transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple) lg:w-auto lg:gap-2 lg:px-3",
                isUnslop
                  ? "rounded-lg bg-(--color-bg-elevated)/70 lg:h-9"
                  : "rounded-full lg:h-10 lg:px-3.5",
                isNavLinkActive(pathname, `/${locale}/search`)
                  ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/12 text-(--color-accent-purple)"
                  : "border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-accent-purple)/50 hover:text-(--color-text-primary)"
              )}
            >
              <Search
                className="h-4 w-4 shrink-0 transition-colors duration-150 group-hover:text-(--color-accent-purple)"
                strokeWidth={1.6}
              />
              <span className="hidden whitespace-nowrap text-xs font-medium lg:inline">
                {dict.nav.search}
              </span>
              <kbd
                dir="ltr"
                className="hidden rounded border border-(--color-border-subtle) bg-(--color-bg-secondary) px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary) transition-colors group-hover:border-(--color-border-strong) group-hover:text-(--color-text-secondary) lg:inline"
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
                "flex h-11 w-11 items-center justify-center border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors active:scale-95 hover:border-(--color-border-strong) hover:text-(--color-text-primary) lg:hidden",
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
        designMode={designMode}
      />

      <CommandPalette locale={locale} fields={fields} />
    </>
  );
}

function DesktopNavLink({
  navKey,
  href,
  label,
  active,
  showIndicator,
  hovered,
  onHover,
  isUnslop = false,
  isKinetic = false,
  hoverSpring,
}: {
  navKey: NavKey;
  href: string;
  label: string;
  active: boolean;
  showIndicator: boolean;
  hovered: boolean;
  onHover: (key: NavKey | null) => void;
  isUnslop?: boolean;
  isKinetic?: boolean;
  hoverSpring:
    | { duration: number }
    | { type: "spring"; stiffness: number; damping: number; mass: number };
}) {
  return (
    <Link
      href={href}
      onMouseEnter={() => onHover(navKey)}
      onFocus={() => onHover(navKey)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple)",
        active || hovered
          ? "text-(--color-text-primary)"
          : "text-(--color-text-secondary)"
      )}
    >
      {hovered && (
        <motion.span
          layoutId="navbar-hover-plate"
          data-testid="nav-hover-plate"
          transition={hoverSpring}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0",
            isUnslop
              ? "rounded-lg bg-(--color-bg-secondary)"
              : "rounded-full bg-(--color-bg-elevated)/80"
          )}
        />
      )}
      <span className="relative z-10">{label}</span>
      {showIndicator && (
        <motion.span
          layoutId="navbar-active-indicator"
          data-testid="nav-active-indicator"
          transition={hoverSpring}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-3.5 -bottom-[14px] h-[2px] rounded-full",
            isKinetic
              ? "bg-(--color-accent-purple)"
              : isUnslop
                ? "bg-(--color-text-primary)"
                : "bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange)"
          )}
        />
      )}
    </Link>
  );
}
