"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Newspaper,
  FolderTree,
  Tags,
  Image as ImageIcon,
  ListTree,
  Mail,
  Inbox,
  MessageSquare,
  Activity,
  Trash2,
  Users,
  Search,
  LogOut,
  Globe,
  Menu,
  X,
  UserCircle,
  KeyRound,
  Plus,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Palette,
  ServerCog,
  Send,
  HardDriveDownload,
} from "lucide-react";
import { useAdminAuth } from "./admin-auth-context";
import { useAdminLocale } from "./admin-locale-context";
import { adminFetch } from "@/lib/admin-api-client";
import { can } from "@/lib/rbac";

interface NavItem {
  href: string;
  labelEn: string;
  labelFa: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  group: "editorial" | "audience" | "platform" | "system";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", labelEn: "Dashboard", labelFa: "داشبورد", icon: LayoutDashboard, permission: "dashboard.view", group: "editorial" },
  { href: "/admin/analytics", labelEn: "Analytics", labelFa: "آمار و تحلیل", icon: BarChart3, permission: "dashboard.view", group: "editorial" },
  { href: "/admin/articles", labelEn: "Articles", labelFa: "مقالات", icon: Newspaper, permission: "articles.manage", group: "editorial" },
  { href: "/admin/fields", labelEn: "Scientific Fields", labelFa: "حوزه‌های علمی", icon: ListTree, permission: "fields.view", group: "editorial" },
  { href: "/admin/categories", labelEn: "Categories", labelFa: "دسته‌بندی‌ها", icon: FolderTree, permission: "categories.view", group: "editorial" },
  { href: "/admin/tags", labelEn: "Tags", labelFa: "برچسب‌ها", icon: Tags, permission: "tags.manage", group: "editorial" },
  { href: "/admin/authors", labelEn: "Authors", labelFa: "نویسندگان", icon: UserCircle, permission: "authors.view", group: "editorial" },
  { href: "/admin/media", labelEn: "Media Library", labelFa: "کتابخانه رسانه", icon: ImageIcon, permission: "media.manage", group: "editorial" },

  { href: "/admin/comments", labelEn: "Comments", labelFa: "دیدگاه‌ها", icon: MessageSquare, permission: "comments.manage", group: "audience" },
  { href: "/admin/email", labelEn: "Email Center", labelFa: "مرکز ایمیل", icon: Send, permission: "email.manage", group: "audience" },
  { href: "/admin/messages", labelEn: "Messages", labelFa: "پیام‌های تماس", icon: Inbox, permission: "messages.manage", group: "audience" },
  { href: "/admin/subscribers", labelEn: "Subscribers", labelFa: "مشترکین خبرنامه", icon: Mail, permission: "subscribers.manage", group: "audience" },

  { href: "/admin/modes", labelEn: "Site Modes", labelFa: "حالت‌های سایت", icon: Palette, permission: "settings.manage", group: "platform" },
  { href: "/admin/api-keys", labelEn: "AI & API Keys", labelFa: "API و هوش مصنوعی", icon: KeyRound, permission: "api_keys.manage", group: "platform" },
  { href: "/admin/users", labelEn: "Users & Roles", labelFa: "کاربران و نقش‌ها", icon: Users, permission: "users.view", group: "platform" },
  { href: "/admin/logs", labelEn: "Activity Logs", labelFa: "گزارش فعالیت‌ها", icon: Activity, permission: "logs.view", group: "platform" },
  { href: "/admin/trash", labelEn: "Recycle Bin", labelFa: "سطل بازیافت", icon: Trash2, permission: "articles.manage", group: "platform" },

  { href: "/admin/backups", labelEn: "Telegram Backups", labelFa: "پشتیبان‌گیری تلگرام", icon: HardDriveDownload, permission: "backup.manage", group: "system" },
  { href: "/admin/system", labelEn: "System & Updates", labelFa: "سیستم و بروزرسانی", icon: ServerCog, permission: "settings.manage", group: "system" },
];

const GROUP_LABELS = {
  editorial: { en: "Editorial", fa: "تحریریه و محتوا" },
  audience: { en: "Audience", fa: "مخاطبان و ارتباط" },
  platform: { en: "Platform & AI", fa: "سامانه و هوش مصنوعی" },
  system: { en: "System & Server", fa: "سرور و استقرار" },
} as const;

interface QuickSearchArticle {
  id: string;
  title_en?: string | null;
  title_fa?: string | null;
  status: string;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth();
  const { isFa, locale, toggleLocale } = useAdminLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Command / Quick Jump modal state
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdArticles, setCmdArticles] = useState<QuickSearchArticle[]>([]);
  const [cmdLoading, setCmdLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close mobile drawer automatically when navigating to a new admin route
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (cmdOpen) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear transient command query when modal closes
      setCmdQuery("");
      setCmdArticles([]);
    }
  }, [cmdOpen]);

  useEffect(() => {
    if (!cmdOpen) return;
    const trimmed = cmdQuery.trim();
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset live article results when query is cleared
      setCmdArticles([]);
      return;
    }
    let cancelled = false;
    setCmdLoading(true);
    const timer = setTimeout(() => {
      adminFetch<{ items: QuickSearchArticle[] }>(
        `/api/admin/articles?search=${encodeURIComponent(trimmed)}&pageSize=5`
      )
        .then((res) => {
          if (!cancelled) setCmdArticles(res.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setCmdArticles([]);
        })
        .finally(() => {
          if (!cancelled) setCmdLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cmdOpen, cmdQuery]);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => !item.permission || !user || can(user.role, item.permission)),
    [user]
  );

  const activeNav = useMemo(
    () => visibleNav.find((item) => pathname?.startsWith(item.href)),
    [visibleNav, pathname]
  );

  const filteredCmdNav = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return visibleNav.slice(0, 7);
    return visibleNav.filter(
      (item) =>
        item.labelEn.toLowerCase().includes(q) ||
        item.labelFa.includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [visibleNav, cmdQuery]);

  if (pathname === "/admin/login") return <>{children}</>;

  const BreadcrumbSep = isFa ? ChevronLeft : ChevronRight;
  const currentSectionLabel = activeNav
    ? isFa
      ? activeNav.labelFa
      : activeNav.labelEn
    : isFa
      ? "مدیریت"
      : "Admin";

  function jumpTo(href: string) {
    setCmdOpen(false);
    router.push(href);
  }

  return (
    <div className="flex min-h-dvh w-full overflow-x-clip bg-(--color-bg-deep) text-(--color-text-primary)">
      {/* Sidebar */}
      <aside
        aria-label={isFa ? "منوی پنل مدیریت" : "Admin sidebar navigation"}
        className={`fixed inset-y-0 start-0 z-40 flex w-64 max-w-[85vw] flex-col border-e border-(--color-border-subtle) bg-(--color-bg-secondary) pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-200 ease-out lg:shadow-none lg:translate-x-0 rtl:lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--color-border-subtle) px-4 sm:h-15 sm:px-5">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2.5 whitespace-nowrap font-[family-name:var(--font-display)] text-sm font-bold tracking-tight text-(--color-text-primary)"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--color-accent-purple) text-xs font-bold text-white">
              S
            </span>
            <span>{isFa ? "مدیریت ساینتا" : "Scienta Admin"}</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary) lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-3.5 overflow-y-auto px-3 py-3">
          {(["editorial", "audience", "platform", "system"] as const).map((groupKey) => {
            const groupItems = visibleNav.filter((item) => item.group === groupKey);
            if (groupItems.length === 0) return null;
            return (
              <div key={groupKey} className="space-y-0.5">
                <p className="px-3 pb-1 text-[11px] font-medium text-(--color-text-tertiary)">
                  {isFa ? GROUP_LABELS[groupKey].fa : GROUP_LABELS[groupKey].en}
                </p>
                {groupItems.map((item) => {
                  const active = pathname?.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
                        active
                          ? "bg-(--color-accent-purple)/15 text-(--color-text-primary)"
                          : "text-(--color-text-secondary) hover:bg-white/[0.04] hover:text-(--color-text-primary)"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-(--color-accent-purple)" : "text-(--color-text-tertiary)"
                        }`}
                      />
                      <span className="truncate">{isFa ? item.labelFa : item.labelEn}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-(--color-border-subtle) p-3">
          <Link
            href={`/${locale}`}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-(--color-text-secondary) transition-colors hover:bg-white/[0.04] hover:text-(--color-text-primary)"
          >
            <span>{isFa ? "مشاهده سایت عمومی" : "View Live Site"}</span>
            <ExternalLink className="h-3.5 w-3.5 text-(--color-text-tertiary)" />
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 overscroll-contain bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:ps-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-(--color-border-subtle) bg-(--color-bg-deep)/95 px-3.5 backdrop-blur-md sm:h-15 sm:gap-4 sm:px-8">
          {/* Left: Mobile trigger + Contextual Breadcrumb */}
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) hover:text-(--color-text-primary) lg:hidden"
              aria-label={isFa ? "باز و بسته کردن منو" : "Toggle menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
              <Link
                href="/admin/dashboard"
                className="hidden whitespace-nowrap text-(--color-text-tertiary) transition-colors hover:text-(--color-text-primary) sm:inline"
              >
                {isFa ? "ساینتا" : "Scienta"}
              </Link>
              <BreadcrumbSep className="hidden h-3.5 w-3.5 shrink-0 text-(--color-text-tertiary)/60 sm:block" />
              <span className="truncate text-[13px] font-semibold text-(--color-text-primary) sm:text-xs sm:font-medium">
                {currentSectionLabel}
              </span>
            </nav>
          </div>

          {/* Right: Quick Jump, Locale Switch, Account */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) sm:hidden"
              aria-label={isFa ? "جستجوی سریع" : "Quick jump search"}
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden h-9 items-center gap-2.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs text-(--color-text-tertiary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) sm:flex whitespace-nowrap shrink-0"
              aria-label={isFa ? "جستجوی سریع" : "Quick jump search"}
            >
              <Search className="h-3.5 w-3.5" />
              <span>{isFa ? "جستجوی سریع" : "Quick jump"}</span>
              <kbd className="rounded border border-(--color-border-subtle) bg-black/30 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleLocale}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-2.5 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap shrink-0 sm:px-3"
              aria-label="Toggle admin language"
            >
              <Globe className="h-3.5 w-3.5 text-(--color-text-tertiary)" />
              <span>{isFa ? "فارسی" : "EN"}</span>
            </button>

            {!loading && user && (
              <div className="flex items-center gap-2 border-s border-(--color-border-subtle) ps-1.5 sm:gap-2.5 sm:ps-2.5">
                <div className="hidden text-end sm:block">
                  <p className="text-xs font-medium leading-tight text-(--color-text-primary)">
                    {user.name}
                  </p>
                  <p className="text-[11px] leading-tight text-(--color-text-tertiary)">
                    {user.role.replace("_", " ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  aria-label={isFa ? "خروج" : "Log out"}
                  title={isFa ? "خروج از حساب" : "Sign out"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) transition-colors hover:border-(--color-accent-red)/50 hover:text-(--color-accent-red)"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1360px] flex-1 overflow-x-clip px-3.5 py-4 sm:p-8">{children}</main>
      </div>

      {/* Quick Jump Command Palette Modal */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-20 backdrop-blur-sm"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-(--color-border-strong) bg-(--color-bg-secondary) shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isFa ? "جستجوی سریع پنل" : "Admin quick jump"}
          >
            <div className="flex items-center gap-2.5 border-b border-(--color-border-subtle) px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-(--color-text-tertiary)" />
              <input
                ref={inputRef}
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder={isFa ? "نام بخش یا عنوان مقاله را بنویسید…" : "Search articles or jump to section…"}
                className="w-full bg-transparent text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="rounded px-1.5 py-0.5 text-[11px] text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              >
                ESC
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {/* Quick Action: New Article */}
              <button
                type="button"
                onClick={() => jumpTo("/admin/articles/new")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-xs font-medium text-(--color-text-primary) transition-colors hover:bg-(--color-accent-purple)/15"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5 text-(--color-accent-purple)" />
                  {isFa ? "نوشتن مقاله جدید" : "Create New Article"}
                </span>
                <span className="text-[11px] text-(--color-text-tertiary)">/admin/articles/new</span>
              </button>

              {/* Matching Live Articles */}
              {cmdQuery.trim().length >= 2 && (
                <div className="mt-2 border-t border-(--color-border-subtle) pt-2">
                  <p className="px-3 pb-1 text-[11px] font-medium text-(--color-text-tertiary)">
                    {isFa ? "مقالات یافت‌شده" : "Matching Articles"}
                    {cmdLoading ? (isFa ? " …" : " …") : ""}
                  </p>
                  {cmdArticles.length === 0 && !cmdLoading ? (
                    <p className="px-3 py-2 text-xs text-(--color-text-tertiary)">
                      {isFa ? "مقاله‌ای پیدا نشد." : "No matching articles found."}
                    </p>
                  ) : (
                    cmdArticles.map((art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => jumpTo(`/admin/articles/${art.id}`)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-xs text-(--color-text-secondary) transition-colors hover:bg-white/[0.05] hover:text-(--color-text-primary)"
                      >
                        <span className="truncate font-medium">
                          {isFa ? art.title_fa || art.title_en : art.title_en || art.title_fa}
                        </span>
                        <span className="shrink-0 text-[11px] text-(--color-text-tertiary)">
                          {art.status}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Sections */}
              <div className="mt-2 border-t border-(--color-border-subtle) pt-2">
                <p className="px-3 pb-1 text-[11px] font-medium text-(--color-text-tertiary)">
                  {isFa ? "بخش‌های پنل" : "Workspace Sections"}
                </p>
                {filteredCmdNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => jumpTo(item.href)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-xs text-(--color-text-secondary) transition-colors hover:bg-white/[0.05] hover:text-(--color-text-primary)"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-(--color-text-tertiary)" />
                        <span>{isFa ? item.labelFa : item.labelEn}</span>
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)">
                        {item.href}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
