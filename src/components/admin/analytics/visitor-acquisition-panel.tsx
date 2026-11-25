"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Compass, Link2, Search } from "lucide-react";
import type { RankedDimensionItem } from "@/lib/visitor-telemetry";

interface VisitorAcquisitionPanelProps {
  channels: RankedDimensionItem[];
  searchEngines: RankedDimensionItem[];
  referrers: RankedDimensionItem[];
  utmCampaigns: Array<{
    source: string;
    medium: string;
    campaign: string;
    pageviews: number;
    visitors: number;
    share: number;
  }>;
  activeChannel: string | null;
  activeSearchEngine: string | null;
  onSelectChannel: (channel: string | null) => void;
  onSelectSearchEngine: (engine: string | null) => void;
  isFa: boolean;
}

const subscribeNoop = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

const CHANNEL_COLORS: Record<string, string> = {
  search: "#8b5cf6",
  ai_search: "#38bdf8",
  direct: "#10b981",
  social: "#f59e0b",
  referral: "#ec4899",
  campaign: "#06b6d4",
};

const ENGINE_COLORS = ["#8b5cf6", "#38bdf8", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7"];

export function VisitorAcquisitionPanel({
  channels,
  searchEngines,
  referrers,
  utmCampaigns,
  activeChannel,
  activeSearchEngine,
  onSelectChannel,
  onSelectSearchEngine,
  isFa,
}: VisitorAcquisitionPanelProps) {
  const hydrated = useIsHydrated();
  const maxChannel = Math.max(1, ...channels.map((c) => c.pageviews));
  const maxRef = Math.max(1, ...referrers.map((r) => r.pageviews));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Search Engines & AI Answer Engines */}
        <section
          aria-label={isFa ? "موتورهای جستجو و موتورهای هوش مصنوعی" : "Search engines and AI answer engines"}
          className="flex min-w-0 flex-col rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-(--color-accent-purple)" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-(--color-text-primary)">
                  {isFa ? "موتورهای جستجو و هوش مصنوعی" : "Search Engines & AI Discovery"}
                </h2>
              </div>
              <p className="mt-1 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "گوگل، بینگ، داک‌داک‌گو، یاندکس، گوگل اسکولار و موتورهای پاسخ AI (ChatGPT, Perplexity, Gemini)"
                  : "Google, Scholar, Bing, DuckDuckGo, Yandex & AI engines (ChatGPT, Perplexity, Gemini)"}
              </p>
            </div>
            {activeSearchEngine && (
              <button
                type="button"
                onClick={() => onSelectSearchEngine(null)}
                className="text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
              >
                {isFa ? "پاک کردن" : "Clear"}
              </button>
            )}
          </div>

          {searchEngines.length === 0 ? (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-(--color-border-subtle) px-4 py-12 text-center">
              <p className="text-xs font-medium text-(--color-text-secondary)">
                {isFa ? "هنوز ورودی از موتورهای جستجو ثبت نشده است." : "No search engine referrals in this window yet."}
              </p>
              <p className="mt-1 max-w-xs text-[11px] text-(--color-text-tertiary)">
                {isFa
                  ? "به محض ورود کاربر از Google، Bing، Perplexity یا ChatGPT در اینجا تفکیک می‌شود."
                  : "Organic search & AI engine visits appear automatically as readers arrive from search."}
              </p>
            </div>
          ) : (
            <>
              {/* Recharts Horizontal Bar Chart */}
              <div className="mt-4 h-[190px] w-full min-w-0" dir="ltr">
                {hydrated && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={searchEngines.slice(0, 7)}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: "#7a7a92", fontSize: 10, fontFamily: "var(--font-mono)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={104}
                        tick={{ fill: "#c8c8dc", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{
                          backgroundColor: "#0c0e16",
                          border: "1px solid rgba(255,255,255,0.14)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="pageviews" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                        {searchEngines.slice(0, 7).map((entry, idx) => (
                          <Cell
                            key={entry.key}
                            fill={
                              activeSearchEngine === entry.key
                                ? "#ffffff"
                                : ENGINE_COLORS[idx % ENGINE_COLORS.length]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Click-to-filter rows */}
              <div className="mt-3 divide-y divide-(--color-border-subtle) border-t border-(--color-border-subtle)">
                {searchEngines.map((eng) => {
                  const selected = activeSearchEngine === eng.key;
                  return (
                    <button
                      key={eng.key}
                      type="button"
                      onClick={() => onSelectSearchEngine(selected ? null : eng.key)}
                      className={`flex w-full items-center justify-between gap-3 py-2.5 text-start text-xs transition-colors ${
                        selected ? "text-(--color-accent-purple)" : "hover:text-(--color-text-primary)"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-(--color-text-primary)">
                          {eng.label}
                        </span>
                        {eng.sublabel && (
                          <span className="font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)">
                            · {eng.sublabel}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                        {eng.visitors.toLocaleString()} {isFa ? "کاربر" : "users"} ·{" "}
                        {eng.pageviews.toLocaleString()} ({eng.share}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Acquisition Channels */}
        <section
          aria-label={isFa ? "کانال‌های جذب ترافیک" : "Traffic acquisition channels"}
          className="flex min-w-0 flex-col rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-(--color-text-primary)">
                  {isFa ? "کانال‌های ورودی ترافیک" : "Acquisition Channels"}
                </h2>
              </div>
              <p className="mt-1 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "تفکیک جستجوی ارگانیک، هوش مصنوعی، شبکه‌های اجتماعی، ارجاعات، کمپین‌ها و مستقیم"
                  : "Organic search, AI search, social communities, referrals, UTM campaigns & direct"}
              </p>
            </div>
            {activeChannel && (
              <button
                type="button"
                onClick={() => onSelectChannel(null)}
                className="text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
              >
                {isFa ? "پاک کردن" : "Clear"}
              </button>
            )}
          </div>

          {channels.length === 0 ? (
            <div className="mt-6 flex flex-1 items-center justify-center rounded-lg border border-dashed border-(--color-border-subtle) py-12 text-xs text-(--color-text-tertiary)">
              {isFa ? "هنوز کانالی در این بازه ثبت نشده است." : "No traffic channels recorded yet."}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {channels.map((ch) => {
                const selected = activeChannel === ch.key;
                const widthPct = Math.max(4, Math.round((ch.pageviews / maxChannel) * 100));
                const color = CHANNEL_COLORS[ch.key] || "#8b5cf6";

                return (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => onSelectChannel(selected ? null : ch.key)}
                    className={`block w-full rounded-lg border px-3 py-2.5 text-start transition-colors ${
                      selected
                        ? "border-(--color-accent-purple) bg-(--color-accent-purple)/12"
                        : "border-transparent bg-white/[0.02] hover:border-(--color-border-subtle) hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 font-medium text-(--color-text-primary)">
                        <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: color }} />
                        <span>{isFa ? ch.labelFa || ch.label : ch.label}</span>
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                        {ch.pageviews.toLocaleString()} {isFa ? "بازدید" : "views"} ·{" "}
                        <span className="text-(--color-text-tertiary)">
                          {ch.visitors.toLocaleString()} {isFa ? "یکتا" : "uniq"} ({ch.share}%)
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Top Referrer Domains & UTM Campaign Attribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-(--color-text-secondary)" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "دامنه‌های ارجاع‌دهنده برتر" : "Top Referrer Domains"}
            </h2>
          </div>
          {referrers.length === 0 ? (
            <p className="mt-4 text-xs text-(--color-text-tertiary)">
              {isFa ? "هنوز دامنه ارجاع‌دهنده‌ای ثبت نشده است." : "No referrer domains recorded yet."}
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {referrers.map((ref) => {
                const widthPct = Math.max(4, Math.round((ref.pageviews / maxRef) * 100));
                return (
                  <div key={ref.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-primary)">
                        {ref.label}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                        {ref.pageviews.toLocaleString()}{" "}
                        <span className="text-(--color-text-tertiary)">({ref.share}%)</span>
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-(--color-accent-purple)/75"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {isFa ? "ردیابی کمپین‌ها (UTM)" : "UTM Campaign Attribution"}
          </h2>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "پارامترهای utm_source، utm_medium و utm_campaign ورودی به سایت"
              : "Tracked utm_source, utm_medium, and utm_campaign parameters"}
          </p>
          {utmCampaigns.length === 0 ? (
            <p className="mt-5 text-xs text-(--color-text-tertiary)">
              {isFa
                ? "هیچ ورودی دارای پارامتر UTM در این بازه ثبت نشده است."
                : "No UTM-tagged campaign visits in this window yet."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-(--color-border-subtle) text-start text-[11px] text-(--color-text-tertiary)">
                    <th className="pb-2 text-start font-medium">{isFa ? "منبع / رسانه" : "Source / Medium"}</th>
                    <th className="pb-2 text-start font-medium">{isFa ? "کمپین" : "Campaign"}</th>
                    <th className="pb-2 text-end font-medium">{isFa ? "بازدید" : "Views"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border-subtle)">
                  {utmCampaigns.map((u, idx) => (
                    <tr key={`${u.source}-${u.medium}-${u.campaign}-${idx}`}>
                      <td className="py-2 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-primary)">
                        {u.source} / <span className="text-(--color-text-tertiary)">{u.medium}</span>
                      </td>
                      <td className="py-2 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                        {u.campaign}
                      </td>
                      <td className="py-2 text-end font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-primary)">
                        {u.pageviews.toLocaleString()}{" "}
                        <span className="text-(--color-text-tertiary)">({u.share}%)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
