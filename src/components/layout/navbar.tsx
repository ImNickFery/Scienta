"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";

export function Navbar({
  locale,
  dict,
  fields,
}: {
  locale: Locale;
  dict: Dictionary;
  fields: FieldRecord[];
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets transient UI state in response to a route change
    setOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: `/${locale}/articles`, label: dict.nav.articles },
    { href: `/${locale}/categories`, label: dict.nav.categories },
    { href: `/${locale}/fields`, label: dict.nav.fields },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];

  return (
    <header
      className={`safe-top sticky top-0 z-50 transition-all duration-500 ${
        scrolled ? "glass-panel shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)]" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-10">
        <Link
          href={`/${locale}`}
          className="group flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-red) transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
            <Sparkles className="h-4 w-4 text-white" />
            <span
              className="absolute inset-0 rounded-lg opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-70"
              style={{ background: "linear-gradient(135deg, #7B3FFB, #FF3C5A)" }}
            />
          </span>
          <span className="text-gradient-aurora">
            Scienta
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "group relative rounded-full px-4 py-2 text-sm transition-colors",
                  active ? "text-(--color-text-primary)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                )}
              >
                {link.label}
                <span
                  className={cn(
                    "absolute inset-x-4 -bottom-0.5 h-px scale-x-0 bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) transition-transform duration-300 group-hover:scale-x-100",
                    active && "scale-x-100"
                  )}
                />
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/search`}
            aria-label={dict.nav.search}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-all hover:border-(--color-accent-purple)/50 hover:text-(--color-text-primary) hover:shadow-[0_0_20px_-6px_rgba(123,63,251,0.6)]"
          >
            <Search className="h-4 w-4" />
          </Link>
          <div className="hidden sm:block">
            <LanguageSwitcher currentLocale={locale} />
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) lg:hidden"
          >
            <Menu className={cn("absolute h-4 w-4 transition-all duration-300", open ? "rotate-90 opacity-0" : "rotate-0 opacity-100")} />
            <X className={cn("absolute h-4 w-4 transition-all duration-300", open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0")} />
          </button>
        </div>
      </nav>

      <div
        className={cn(
          "glass-panel overflow-hidden border-t border-(--color-border-subtle) transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden",
          open ? "max-h-96 opacity-100" : "max-h-0 border-t-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-1 px-5 pb-6 pt-2">
          {navLinks.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-3 text-sm transition-colors",
                  active ? "bg-white/5 text-(--color-text-primary)" : "text-(--color-text-secondary) hover:bg-white/5 hover:text-(--color-text-primary)"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mt-3 border-t border-(--color-border-subtle) pt-3">
            <LanguageSwitcher currentLocale={locale} />
          </div>
        </div>
      </div>

      <div className="hidden border-t border-(--color-border-subtle)/60 lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-5 py-2 sm:px-8 lg:px-10">
          {fields.slice(0, 8).map((f) => {
            const active = pathname === `/${locale}/fields/${f.slug}`;
            return (
              <Link
                key={f.slug}
                href={`/${locale}/fields/${f.slug}`}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors",
                  active ? "text-(--color-text-primary)" : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full transition-opacity" style={{ background: f.color, opacity: active ? 1 : 0.5 }} />
                {f.name[locale]}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
