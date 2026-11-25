"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyTrendPoint } from "@/lib/admin-analytics";
import { computeMovingAverage, type ProWindowDays } from "@/lib/admin-analytics-pro";

export type PrimaryChartSeries = "traffic" | "activity" | "subscribers" | "comments";

interface VisitorTrafficChartProps {
  trends: {
    pageviews: DailyTrendPoint[];
    visitors: DailyTrendPoint[];
    activity: DailyTrendPoint[];
    subscribers: DailyTrendPoint[];
    comments: DailyTrendPoint[];
  };
  rangeDays: ProWindowDays;
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

interface TooltipRow {
  date: string;
  label: string;
  primary: number;
  secondary?: number;
  ma7?: number;
}

function CustomTrafficTooltip({
  active,
  payload,
  series,
  showMa,
  isFa,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TooltipRow }>;
  series: PrimaryChartSeries;
  showMa: boolean;
  isFa: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const primaryLabel =
    series === "traffic"
      ? isFa
        ? "بازدید صفحه"
        : "Pageviews"
      : series === "activity"
        ? isFa
          ? "رویدادها"
          : "Events"
        : series === "subscribers"
          ? isFa
            ? "مشترک جدید"
            : "New subscribers"
          : isFa
            ? "دیدگاه"
            : "Comments";

  return (
    <div
      dir={isFa ? "rtl" : "ltr"}
      className="min-w-[190px] rounded-lg border border-(--color-border-strong) bg-[#0c0e16]/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-sm"
    >
      <p className="font-medium text-(--color-text-primary)">
        {formatFullDate(row.date, row.label, isFa)}
      </p>
      <div className="mt-2 space-y-1.5 font-[family-name:var(--font-mono)] tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-(--color-text-secondary)">
            <span className="inline-block h-0.5 w-3 rounded-full bg-[#8b5cf6]" />
            {primaryLabel}
          </span>
          <span className="font-semibold text-(--color-text-primary)">
            {row.primary.toLocaleString()}
          </span>
        </div>

        {series === "traffic" && typeof row.secondary === "number" && (
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-(--color-text-secondary)">
              <span className="inline-block h-0.5 w-3 rounded-full bg-[#38bdf8]" />
              {isFa ? "بازدیدکننده یکتا" : "Unique visitors"}
            </span>
            <span className="font-semibold text-[#38bdf8]">
              {row.secondary.toLocaleString()}
            </span>
          </div>
        )}

        {showMa && typeof row.ma7 === "number" && (
          <div className="flex items-center justify-between gap-4 border-t border-(--color-border-subtle) pt-1.5">
            <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-(--color-text-tertiary)">
              <span className="inline-block h-0.5 w-3 rounded-full bg-[#f59e0b]" />
              {isFa ? "میانگین ۷ روزه" : "7D moving avg"}
            </span>
            <span className="text-[#f59e0b]">{row.ma7.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function VisitorTrafficChart({ trends, rangeDays, isFa }: VisitorTrafficChartProps) {
  const [series, setSeries] = useState<PrimaryChartSeries>("traffic");
  const [showMa, setShowMa] = useState(true);
  const hydrated = useIsHydrated();

  const baseSeries =
    series === "traffic"
      ? trends.pageviews
      : series === "activity"
        ? trends.activity
        : series === "subscribers"
          ? trends.subscribers
          : trends.comments;

  const chartData = useMemo(() => {
    const ma = computeMovingAverage(baseSeries, 7);
    return baseSeries.map((pt, idx) => ({
      date: pt.date,
      label: pt.label,
      displayLabel: formatAxisDate(pt.date, pt.label, isFa),
      primary: pt.count,
      secondary: series === "traffic" ? (trends.visitors[idx]?.count ?? 0) : undefined,
      ma7: ma[idx]?.value ?? 0,
    }));
  }, [baseSeries, trends.visitors, series, isFa]);

  const totalPrimary = useMemo(
    () => baseSeries.reduce((sum, p) => sum + p.count, 0),
    [baseSeries]
  );
  const totalSecondary = useMemo(
    () => (series === "traffic" ? trends.visitors.reduce((sum, p) => sum + p.count, 0) : 0),
    [series, trends.visitors]
  );

  const maxY = useMemo(
    () => Math.max(0, ...chartData.map((d) => Math.max(d.primary, d.secondary ?? 0))),
    [chartData]
  );
  const { domain: yDomain, ticks: yTicks } = useMemo(() => {
    if (maxY <= 0) return { domain: [0, 4] as [number, number], ticks: [0, 1, 2, 3, 4] };
    const rawStep = (maxY * 1.15) / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))));
    const normalized = rawStep / magnitude;
    const niceNorm =
      normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 3 ? 3 : normalized <= 5 ? 5 : 10;
    const step = Math.max(1, Math.round(niceNorm * magnitude));
    const top = step * 4;
    return {
      domain: [0, top] as [number, number],
      ticks: [0, step, step * 2, step * 3, top],
    };
  }, [maxY]);

  const strokeColor =
    series === "traffic"
      ? "#8b5cf6"
      : series === "activity"
        ? "#38bdf8"
        : series === "subscribers"
          ? "#ff7a00"
          : "#10b981";

  return (
    <section
      aria-label={isFa ? "نمودار روند ترافیک و بازدیدکنندگان" : "Traffic and unique visitors time series"}
      className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {series === "traffic"
              ? isFa
                ? `روند بازدیدها و کاربران یکتا (${rangeDays} روز اخیر)`
                : `Traffic & Unique Visitors (${rangeDays}D)`
              : series === "activity"
                ? isFa
                  ? `رویدادهای تحریریه و سیستم (${rangeDays} روز اخیر)`
                  : `Editorial & System Activity (${rangeDays}D)`
                : series === "subscribers"
                  ? isFa
                    ? `عضویت‌های خبرنامه (${rangeDays} روز اخیر)`
                    : `Newsletter Signups (${rangeDays}D)`
                  : isFa
                    ? `روند ثبت دیدگاه‌ها (${rangeDays} روز اخیر)`
                    : `Reader Comments (${rangeDays}D)`}
          </h2>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {series === "traffic"
              ? isFa
                ? `${totalPrimary.toLocaleString()} بازدید صفحه · مجموع روزانه کاربران یکتا: ${totalSecondary.toLocaleString()}`
                : `${totalPrimary.toLocaleString()} pageviews · ${totalSecondary.toLocaleString()} daily unique visitor-days`
              : isFa
                ? `مجموع بازه: ${totalPrimary.toLocaleString()} مورد`
                : `Window total: ${totalPrimary.toLocaleString()}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label={isFa ? "انتخاب سری نمودار" : "Select time series"}
            className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-xs"
          >
            {(
              [
                { id: "traffic", en: "Traffic", fa: "ترافیک" },
                { id: "activity", en: "Activity", fa: "فعالیت" },
                { id: "subscribers", en: "Subscribers", fa: "مشترکین" },
                { id: "comments", en: "Comments", fa: "دیدگاه‌ها" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={series === tab.id}
                onClick={() => setSeries(tab.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                  series === tab.id
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? tab.fa : tab.en}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={showMa}
            onClick={() => setShowMa((v) => !v)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              showMa
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            }`}
          >
            {isFa ? "میانگین ۷ روزه" : "7D Avg"}
          </button>
        </div>
      </div>

      <div className="mt-5 h-[270px] w-full min-w-0" dir="ltr">
        {hydrated ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 2 }}>
              <defs>
                <linearGradient id="visitorTrafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
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
                minTickGap={40}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                domain={yDomain}
                ticks={yTicks}
                tick={{ fill: "#7a7a92", fontSize: 11, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "2 3" }}
                content={<CustomTrafficTooltip series={series} showMa={showMa} isFa={isFa} />}
              />
              <Area
                type="monotone"
                dataKey="primary"
                stroke={strokeColor}
                strokeWidth={2.2}
                fill="url(#visitorTrafficGrad)"
                dot={false}
                activeDot={{ r: 4.5, fill: "#f5f5fa", stroke: strokeColor, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {series === "traffic" && (
                <Line
                  type="monotone"
                  dataKey="secondary"
                  stroke="#38bdf8"
                  strokeWidth={1.9}
                  dot={false}
                  activeDot={{ r: 4, fill: "#f5f5fa", stroke: "#38bdf8", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
              {showMa && (
                <Line
                  type="monotone"
                  dataKey="ma7"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-white/[0.02]" />
        )}
      </div>

      {/* Clean Legend Footer */}
      <div className="mt-3 flex flex-wrap items-center gap-5 border-t border-(--color-border-subtle) pt-3 text-xs text-(--color-text-tertiary)">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: strokeColor }}
          />
          <span>
            {series === "traffic"
              ? isFa
                ? "بازدید صفحات"
                : "Pageviews"
              : series === "activity"
                ? isFa
                  ? "رویدادها"
                  : "Events"
                : series === "subscribers"
                  ? isFa
                    ? "مشترکین جدید"
                    : "Subscribers"
                  : isFa
                    ? "دیدگاه‌ها"
                    : "Comments"}
          </span>
        </span>
        {series === "traffic" && (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 rounded-full bg-[#38bdf8]" />
            <span>{isFa ? "بازدیدکنندگان یکتا" : "Unique visitors"}</span>
          </span>
        )}
        {showMa && (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 border-t border-dashed border-[#f59e0b]" />
            <span>{isFa ? "میانگین متحرک ۷ روزه" : "7-day moving average"}</span>
          </span>
        )}
      </div>
    </section>
  );
}
