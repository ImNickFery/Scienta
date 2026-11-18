"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper, Eye, Users, Mail, Image as ImageIcon, FileEdit, CalendarClock, Activity } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface DashboardStats {
  articles: { total: number; published: number; draft: number; scheduled: number };
  totals: { views: number; authors: number; subscribers: number; new_messages: number; media: number };
  topArticles: { title: string; slug: string; views: number }[];
  byField: { name: string; color: string; count: number }[];
  recentActivity: { id: string; action: string; entity_type: string | null; created_at: string; user_name: string | null }[];
  recentMessages: { id: string; name: string; subject: string | null; created_at: string }[];
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Newspaper; label: string; value: string | number; accent: string }) {
  return (
    <div className="card-elevated rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${accent}22`, color: accent }}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold text-(--color-text-primary)">{value}</p>
      <p className="text-xs text-(--color-text-tertiary)">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<DashboardStats>("/api/admin/dashboard/stats")
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-(--color-accent-red)">{error}</p>;
  if (!stats) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Dashboard</h1>
        <p className="text-sm text-(--color-text-tertiary)">Overview of your content platform</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Newspaper} label="Published Articles" value={stats.articles.published} accent="#7B3FFB" />
        <StatCard icon={Eye} label="Total Views" value={stats.totals.views.toLocaleString()} accent="#FF7A00" />
        <StatCard icon={Users} label="Subscribers" value={stats.totals.subscribers} accent="#FF3C5A" />
        <StatCard icon={Mail} label="New Messages" value={stats.totals.new_messages} accent="#7B3FFB" />
        <StatCard icon={FileEdit} label="Drafts" value={stats.articles.draft} accent="#FF7A00" />
        <StatCard icon={CalendarClock} label="Scheduled" value={stats.articles.scheduled} accent="#FF3C5A" />
        <StatCard icon={ImageIcon} label="Media Files" value={stats.totals.media} accent="#7B3FFB" />
        <StatCard icon={Users} label="Authors" value={stats.totals.authors} accent="#FF7A00" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-elevated rounded-2xl p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-(--color-text-primary)">Top Articles</h2>
          <div className="space-y-3">
            {stats.topArticles.map((a) => (
              <div key={a.slug} className="flex items-center justify-between border-b border-(--color-border-subtle) pb-3 last:border-0 last:pb-0">
                <span className="truncate text-sm text-(--color-text-secondary)">{a.title}</span>
                <span className="shrink-0 text-xs text-(--color-text-tertiary)">{a.views.toLocaleString()} views</span>
              </div>
            ))}
            {stats.topArticles.length === 0 && <p className="text-sm text-(--color-text-tertiary)">No published articles yet.</p>}
          </div>
        </div>

        <div className="card-elevated rounded-2xl p-6">
          <h2 className="mb-4 text-sm font-semibold text-(--color-text-primary)">By Field</h2>
          <div className="space-y-3">
            {stats.byField.map((f) => (
              <div key={f.name} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                <span className="flex-1 text-xs text-(--color-text-secondary)">{f.name}</span>
                <span className="text-xs text-(--color-text-tertiary)">{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-elevated rounded-2xl p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
            <Activity className="h-4 w-4" /> Recent Activity
          </h2>
          <div className="space-y-3">
            {stats.recentActivity.map((log) => (
              <div key={log.id} className="text-xs text-(--color-text-tertiary)">
                <span className="text-(--color-text-secondary)">{log.user_name ?? "System"}</span> — {log.action}
                <span className="ms-2 opacity-60">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
            {stats.recentActivity.length === 0 && <p className="text-sm text-(--color-text-tertiary)">No activity yet.</p>}
          </div>
        </div>

        <div className="card-elevated rounded-2xl p-6">
          <h2 className="mb-4 text-sm font-semibold text-(--color-text-primary)">New Contact Messages</h2>
          <div className="space-y-3">
            {stats.recentMessages.map((m) => (
              <Link key={m.id} href="/admin/messages" className="block text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary)">
                <span className="text-(--color-text-secondary)">{m.name}</span> — {m.subject ?? "(no subject)"}
              </Link>
            ))}
            {stats.recentMessages.length === 0 && <p className="text-sm text-(--color-text-tertiary)">No new messages.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card-elevated h-28 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}
