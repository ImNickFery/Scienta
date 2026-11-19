"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Newspaper, FolderTree, Tags, Image as ImageIcon,
  ListTree, Mail, Inbox, MessageSquare, Activity, Trash2, Users,
  Search, LogOut, Globe, Menu, X, Sparkles, UserCircle,
} from "lucide-react";
import { useAdminAuth } from "./admin-auth-context";
import { can } from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/admin/articles", label: "Articles", icon: Newspaper, permission: "articles.manage" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "categories.view" },
  { href: "/admin/fields", label: "Scientific Fields", icon: ListTree, permission: "fields.view" },
  { href: "/admin/tags", label: "Tags", icon: Tags, permission: "tags.manage" },
  { href: "/admin/authors", label: "Authors", icon: UserCircle, permission: "authors.view" },
  { href: "/admin/media", label: "Media Library", icon: ImageIcon, permission: "media.manage" },
  { href: "/admin/subscribers", label: "Subscribers", icon: Mail, permission: "subscribers.manage" },
  { href: "/admin/messages", label: "Contact Messages", icon: Inbox, permission: "messages.manage" },
  { href: "/admin/comments", label: "Comments", icon: MessageSquare, permission: "comments.manage" },
  { href: "/admin/users", label: "Users & Roles", icon: Users, permission: "users.view" },
  { href: "/admin/logs", label: "Activity Logs", icon: Activity, permission: "logs.view" },
  { href: "/admin/trash", label: "Recycle Bin", icon: Trash2, permission: "articles.manage" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");

  useEffect(() => {
    const stored = window.localStorage.getItem("admin_dir");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time persisted preference on mount
    if (stored === "rtl" || stored === "ltr") setDir(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = dir === "rtl" ? "fa" : "en";
    window.localStorage.setItem("admin_dir", dir);
  }, [dir]);

  if (pathname === "/admin/login") return <>{children}</>;

  const visibleNav = NAV_ITEMS.filter((item) => !item.permission || !user || can(user.role, item.permission));

  return (
    <div className="flex min-h-dvh bg-(--color-bg-deep) text-(--color-text-primary)">
      {/* Sidebar */}
      <aside
        className={`glass-panel fixed inset-y-0 start-0 z-40 w-64 -translate-x-full border-e transition-transform duration-300 lg:translate-x-0 rtl:translate-x-full rtl:lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 rtl:translate-x-0" : ""
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-(--color-border-subtle) px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-red)">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <span className="font-[family-name:var(--font-display)] text-sm font-bold text-gradient-aurora">
            Scienta Admin
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 overflow-y-auto px-3 py-4" style={{ height: "calc(100vh - 4rem)" }}>
          {visibleNav.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-gradient-to-r from-(--color-accent-purple)/20 to-transparent text-(--color-text-primary)"
                    : "text-(--color-text-tertiary) hover:bg-white/5 hover:text-(--color-text-primary)"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 overscroll-contain bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex min-h-dvh flex-1 flex-col lg:ps-64">
        <header className="glass-panel sticky top-0 z-20 flex h-16 items-center justify-between border-b px-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-(--color-text-secondary) lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-(--color-border-subtle) px-3 py-1.5 text-xs text-(--color-text-tertiary) sm:flex">
              <Search className="h-3.5 w-3.5" />
              <Link href="/admin/articles" className="hover:text-(--color-text-primary)">
                Search articles…
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDir((d) => (d === "ltr" ? "rtl" : "ltr"))}
              className="flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-3 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
              aria-label="Toggle direction"
            >
              <Globe className="h-3.5 w-3.5" />
              {dir === "ltr" ? "EN" : "FA"}
            </button>

            {!loading && user && (
              <div className="flex items-center gap-2">
                <div className="hidden text-end sm:block">
                  <p className="text-xs font-medium text-(--color-text-primary)">{user.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-(--color-text-tertiary)">{user.role.replace("_", " ")}</p>
                </div>
                <button
                  onClick={logout}
                  aria-label="Log out"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-accent-red)/50 hover:text-(--color-accent-red)"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
