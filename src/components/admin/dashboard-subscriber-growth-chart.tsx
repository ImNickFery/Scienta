"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import type { SubscriberGrowthPoint, SubscriberGrowthSummary } from "@/lib/admin-analytics";

interface DashboardSubscriberGrowthChartProps {
  data: SubscriberGrowthSummary;
  isFa: boolean;
}

type SeriesMode = "both" | "cumulative" | "daily";

const subscribeNoop = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

function formatAxisDate(isoDate: string, fallback: string, isFa: boolean): string {
  if (!isFa || !isoDate) return fallback;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(d);
}

function formatFullDate(isoDate: string, fallback: string, isFa: boolean): string {
  if (!isoDate) return fallback;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat(isFa ? "fa-IR" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

interface CustomTooltipPayloadItem {
  dataKey?: string | number;
  value?: number;
  payload?: SubscriberGrowthPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  isFa: boolean;
}

function SubscriberGrowthTooltip({ active, payload, isFa }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      dir={isFa ? "rtl" : "ltr"}
      className="min-w-[190px] rounded-lg border border-(--color-border-strong) bg-[#0c0e16]/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-sm"
    >
      <p className="font-medium text-(--color-text-primary)">
        {formatFullDate(point.date, point.label, isFa)}
      </p>
      <div className="mt-2 space-y-1.5 font-[family-name:var(--font-mono)] tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-(--color-text-secondary)">
            <span className="inline-block h-0.5 w-3 rounded-full bg-[#8b5cf6]" />
            {isFa ? "مجموع مشترکین" : "Total subscribers"}
          </span>
          <span className="font-semibold text-(--color-text-primary)">
            {point.cumulativeSubscribers.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-(--color-text-secondary)">
            <span className="inline-block h-0.5 w-3 rounded-full bg-[#38bdf8]" />
            {isFa ? "عضویت جدید" : "New signups"}
          </span>
          <span className="font-semibold text-[#38bdf8]">
            +{point.newSubscribers.toLocaleString()}
          </span>
        </div>
        {point.newSubscribers > 0 && (
          <div className="border-t border-(--color-border-subtle) pt-1.5 text-[10px] text-(--color-text-tertiary)">
            {isFa
              ? `فارسی ${point.faNew.toLocaleString()} · انگلیسی ${point.enNew.toLocaleString()}`
              : `FA ${point.faNew.toLocaleString()} · EN ${point.enNew.toLocaleString()}`}
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardSubscriberGrowthChart({
  data,
  isFa,
}: DashboardSubscriberGrowthChartProps) {
  const [mode, setMode] = useState<SeriesMode>("both");
  const hydrated = useIsHydrated();

  const chartData = useMemo(
    () =>
      data.points.map((pt) => ({
        ...pt,
        displayLabel: formatAxisDate(pt.date, pt.label, isFa),
      })),
    [data.points, isFa]
  );

  const maxCumulative = useMemo(
    () => Math.max(0, ...data.points.map((p) => p.cumulativeSubscribers)),
    [data.points]
  );
  const maxDaily = useMemo(
    () => Math.max(0, ...data.points.map((p) => p.newSubscribers)),
    [data.points]
  );

  const cumulativeDomain: [number, number] = [
    0,
    maxCumulative === 0 ? 4 : Math.max(4, Math.ceil((maxCumulative * 1.15) / 2) * 2),
  ];
  const dailyDomain: [number, number] = [
    0,
    maxDaily === 0 ? 4 : Math.max(4, Math.ceil((maxDaily * 1.25) / 2) * 2),
  ];

  const peakLabel = formatAxisDate(data.peakDay.date, data.peakDay.label, isFa);
  const growthPrefix = data.growthRatePct > 0 ? "+" : "";

  return (
    <section
      aria-label={isFa ? "نمودار رشد مشترکین در ۳۰ روز اخیر" : "Subscriber growth over the last 30 days"}
      className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-(--color-accent-purple)" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "روند رشد مشترکین (۳۰ روز اخیر)" : "Subscriber Growth (Last 30 Days)"}
            </h2>
          </div>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `+${data.addedLast30d.toLocaleString()} عضو جدید · رشد ${growthPrefix}${data.growthRatePct}% · میانگین ${data.avgDaily}/روز · اوج ${data.peakDay.count.toLocaleString()}${data.peakDay.count > 0 ? ` (${peakLabel})` : ""}`
              : `+${data.addedLast30d.toLocaleString()} new in 30d · ${growthPrefix}${data.growthRatePct}% growth · ${data.avgDaily}/day avg · Peak ${data.peakDay.count.toLocaleString()}${data.peakDay.count > 0 ? ` (${peakLabel})` : ""}`}
          </p>
        </div>

        {/* Series Mode Segmented Switcher */}
        <div
          role="tablist"
          aria-label={isFa ? "حالت نمایش نمودار مشترکین" : "Subscriber chart series mode"}
          className="flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-xs"
        >
          {(
            [
              { id: "both", en: "Both", fa: "هر دو" },
              { id: "cumulative", en: "Cumulative", fa: "تجمعی" },
              { id: "daily", en: "Daily New", fa: "روزانه" },
            ] as const
          ).map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(tab.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? tab.fa : tab.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recharts Line Chart Container */}
      <div className="mt-5 h-[260px] w-full min-w-0" dir="ltr">
        {hydrated ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: mode === "both" ? 12 : 16, left: -12, bottom: 2 }}
            >
              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 4"
                vertical={false}
              />
              <XAxis
                dataKey="displayLabel"
                tick={{ fill: "#7a7a92", fontSize: 11, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tickLine={false}
                minTickGap={42}
                interval="preserveStartEnd"
              />
              {(mode === "both" || mode === "cumulative") && (
                <YAxis
                  yAxisId="cumulative"
                  allowDecimals={false}
                  domain={cumulativeDomain}
                  tick={{ fill: "#7a7a92", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
              )}
              {(mode === "both" || mode === "daily") && (
                <YAxis
                  yAxisId="daily"
                  orientation={mode === "both" ? "right" : "left"}
                  allowDecimals={false}
                  domain={dailyDomain}
                  tick={{
                    fill: mode === "both" ? "#38bdf8" : "#7a7a92",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={mode === "both" ? 34 : 42}
                />
              )}
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "2 3" }}
                content={<SubscriberGrowthTooltip isFa={isFa} />}
              />
              {(mode === "both" || mode === "cumulative") && (
                <Line
                  yAxisId="cumulative"
                  type="monotone"
                  dataKey="cumulativeSubscribers"
                  name={isFa ? "مجموع مشترکین" : "Total Subscribers"}
                  stroke="#8b5cf6"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4.5, fill: "#f5f5fa", stroke: "#8b5cf6", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
              {(mode === "both" || mode === "daily") && (
                <Line
                  yAxisId="daily"
                  type="monotone"
                  dataKey="newSubscribers"
                  name={isFa ? "عضویت روزانه" : "Daily New"}
                  stroke="#38bdf8"
                  strokeWidth={1.9}
                  strokeDasharray={mode === "both" ? "4 3" : undefined}
                  dot={false}
                  activeDot={{ r: 4, fill: "#f5f5fa", stroke: "#38bdf8", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-white/[0.02]" />
        )}
      </div>

      {/* Footer Legend & Quick Navigation */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-subtle) pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-(--color-text-tertiary)">
          {(mode === "both" || mode === "cumulative") && (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0.5 w-4 rounded-full bg-[#8b5cf6]" />
              <span>{isFa ? "مجموع تجمعی" : "Cumulative total"}</span>
            </span>
          )}
          {(mode === "both" || mode === "daily") && (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0.5 w-4 rounded-full bg-[#38bdf8]" />
              <span>{isFa ? "عضویت جدید روزانه" : "Daily new signups"}</span>
            </span>
          )}
          <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums">
            {data.totalActive === 0 && data.addedLast30d === 0
              ? isFa
                ? "هنوز مشترکی در ۳۰ روز اخیر ثبت نشده است"
                : "No signups recorded in the last 30 days yet"
              : isFa
                ? `${data.totalActive.toLocaleString()} مشترک فعال · پایه ۳۰ روز قبل: ${data.previousBaseline.toLocaleString()}`
                : `${data.totalActive.toLocaleString()} active total · 30d baseline: ${data.previousBaseline.toLocaleString()}`}
          </span>
        </div>

        <div className="flex items-center gap-4 whitespace-nowrap">
          <Link
            href="/admin/subscribers"
            className="inline-flex items-center gap-1 font-medium text-(--color-accent-purple) transition-opacity hover:opacity-80"
          >
            {isFa ? "مدیریت مشترکین" : "Manage subscribers"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/email"
            className="font-medium text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
          >
            {isFa ? "مرکز ایمیل" : "Email center"}
          </Link>
        </div>
      </div>
    </section>
  );
}
