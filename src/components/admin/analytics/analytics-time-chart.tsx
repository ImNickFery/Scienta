"use client";

import { useMemo, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { buildTrendSvgGeometry, type DailyTrendPoint } from "@/lib/admin-analytics";
import { computeMovingAverage } from "@/lib/admin-analytics-pro";

export type AnalyticsSeriesKey = "pageviews" | "activity" | "subscribers" | "comments";

interface AnalyticsTimeChartProps {
  trends: Record<AnalyticsSeriesKey, DailyTrendPoint[]>;
  rangeDays: number;
  isFa: boolean;
}

const SERIES_META: Record<
  AnalyticsSeriesKey,
  { en: string; fa: string; unitEn: string; unitFa: string; color: string; gradId: string }
> = {
  pageviews: {
    en: "Live Views",
    fa: "بازدید زنده",
    unitEn: "views",
    unitFa: "بازدید",
    color: "#7b3ffb",
    gradId: "proGradPageviews",
  },
  activity: {
    en: "Editorial",
    fa: "فعالیت تحریریه",
    unitEn: "events",
    unitFa: "رویداد",
    color: "#38bdf8",
    gradId: "proGradActivity",
  },
  subscribers: {
    en: "Subscribers",
    fa: "مشترکین",
    unitEn: "subs",
    unitFa: "مشترک",
    color: "#ff7a00",
    gradId: "proGradSubs",
  },
  comments: {
    en: "Comments",
    fa: "دیدگاه‌ها",
    unitEn: "comments",
    unitFa: "دیدگاه",
    color: "#10b981",
    gradId: "proGradComments",
  },
};

function formatDateLabel(isoDate: string, fallback: string, isFa: boolean): string {
  if (!isFa || !isoDate) return fallback;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(d);
}

export function AnalyticsTimeChart({ trends, rangeDays, isFa }: AnalyticsTimeChartProps) {
  const defaultSeries: AnalyticsSeriesKey =
    trends.pageviews.some((p) => p.count > 0) ? "pageviews" : "activity";

  const [series, setSeries] = useState<AnalyticsSeriesKey>(defaultSeries);
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeData = trends[series] ?? [];
  const meta = SERIES_META[series];

  const { totalCount, avgDaily, peakPoint, movingAvg, geom, maPath } = useMemo(() => {
    const total = activeData.reduce((sum, p) => sum + p.count, 0);
    const avg = activeData.length > 0 ? Number((total / activeData.length).toFixed(1)) : 0;
    const peak = activeData.reduce(
      (best, p) => (p.count > best.count ? p : best),
      activeData[0] ?? { date: "", label: "-", count: 0 }
    );
    const ma = computeMovingAverage(activeData, Math.min(7, Math.max(3, Math.floor(activeData.length / 4))));
    const maxVal = Math.max(
      1,
      ...activeData.map((p) => p.count),
      ...ma.map((p) => Math.ceil(p.value))
    );
    const g = buildTrendSvgGeometry(activeData, 760, 240, 18, 22, maxVal);

    // Compute moving-average SVG path on the exact same scale
    const usableW = 760 - 36;
    const usableH = 240 - 44;
    const stepX = ma.length > 1 ? usableW / (ma.length - 1) : 0;
    const maSvg = ma
      .map((pt, i) => {
        const x = Number((18 + i * stepX).toFixed(2));
        const ratio = Math.min(1, Math.max(0, pt.value / maxVal));
        const y = Number((22 + usableH * (1 - ratio)).toFixed(2));
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");

    return { totalCount: total, avgDaily: avg, peakPoint: peak, movingAvg: ma, geom: g, maPath: maSvg };
  }, [activeData]);

  const width = 760;
  const height = 240;
  const activePoint =
    hoveredIdx !== null && geom.coords[hoveredIdx] ? geom.coords[hoveredIdx] : null;
  const activeMa = hoveredIdx !== null && movingAvg[hoveredIdx] ? movingAvg[hoveredIdx] : null;
  const peakLabel = formatDateLabel(peakPoint.date, peakPoint.label, isFa);

  const barSlotW = activeData.length > 0 ? (width - 36) / activeData.length : 16;
  const barW = Math.max(3, Math.min(20, barSlotW * 0.62));
  const baselineY = height - 22;
  const usableH = height - 44;

  return (
    <section className="flex flex-col justify-between rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {isFa ? `نمودار روند ${rangeDays} روزه` : `${rangeDays}-Day Time-Series Analysis`}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            <span>
              {isFa
                ? `مجموع: ${totalCount.toLocaleString()}`
                : `Total: ${totalCount.toLocaleString()}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isFa
                ? `میانگین روزانه: ${avgDaily.toLocaleString()}`
                : `Daily avg: ${avgDaily.toLocaleString()}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isFa
                ? `اوج: ${peakPoint.count.toLocaleString()} (${peakLabel})`
                : `Peak: ${peakPoint.count.toLocaleString()} (${peakLabel})`}
            </span>
          </p>
        </div>

        {/* Series + Chart Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label={isFa ? "انتخاب سری داده" : "Select data series"}
            className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-[11px]"
          >
            {(Object.keys(SERIES_META) as AnalyticsSeriesKey[]).map((key) => {
              const active = series === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSeries(key);
                    setHoveredIdx(null);
                  }}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors whitespace-nowrap ${
                    active
                      ? "bg-white/[0.12] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? SERIES_META[key].fa : SERIES_META[key].en}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5">
            <button
              type="button"
              onClick={() => setChartType("area")}
              aria-label={isFa ? "نمودار خطی" : "Area view"}
              title={isFa ? "نمودار مساحتی" : "Area chart"}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                chartType === "area"
                  ? "bg-white/[0.12] text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType("bar")}
              aria-label={isFa ? "نمودار ستونی" : "Bar view"}
              title={isFa ? "نمودار ستونی" : "Bar chart"}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                chartType === "bar"
                  ? "bg-white/[0.12] text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            aria-pressed={showMovingAvg}
            onClick={() => setShowMovingAvg((v) => !v)}
            className={`h-8 rounded-lg border px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
              showMovingAvg
                ? "border-(--color-border-strong) bg-white/[0.08] text-(--color-text-primary)"
                : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            }`}
          >
            {isFa ? "میانگین متحرک" : "7D Avg"}
          </button>
        </div>
      </div>

      {/* Interactive SVG Viewport */}
      <div className="relative mt-5">
        {/* Zero-CLS Readout Bar */}
        <div className="mb-2 flex h-5 items-center justify-between font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
          <span>
            {activePoint
              ? isFa
                ? formatDateLabel(activePoint.date, activePoint.label, true)
                : `${activePoint.label} · ${activePoint.date}`
              : isFa
                ? "نشانگر را روی نمودار حرکت دهید"
                : "Hover chart to inspect exact daily metrics"}
          </span>
          <span className="flex items-center gap-3 text-(--color-text-primary)">
            {activePoint ? (
              <>
                <span className="font-semibold">
                  {activePoint.value.toLocaleString()} {isFa ? meta.unitFa : meta.unitEn}
                </span>
                {showMovingAvg && activeMa && (
                  <span className="text-(--color-text-tertiary)">
                    {isFa ? "میانگین" : "MA"}: {activeMa.value}
                  </span>
                )}
              </>
            ) : (
              <span className="text-(--color-text-tertiary)">
                {isFa ? meta.fa : meta.en} · {totalCount.toLocaleString()}
              </span>
            )}
          </span>
        </div>

        <div dir="ltr">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-60 w-full overflow-visible"
          role="img"
          aria-label={`${rangeDays}-day ${meta.en} analytics chart`}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id={meta.gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity="0.34" />
              <stop offset="100%" stopColor={meta.color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal reference gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
            const y = 22 + usableH * fraction;
            const tickVal = Math.round(geom.maxValue * (1 - fraction));
            return (
              <g key={i}>
                <line
                  x1={18}
                  y1={y}
                  x2={width - 18}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray={fraction === 1 ? undefined : "3 4"}
                />
                {i % 2 === 0 && (
                  <text
                    x={width - 18}
                    y={y - 4}
                    textAnchor="end"
                    fill="#7a7a92"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                  >
                    {tickVal.toLocaleString()}
                  </text>
                )}
              </g>
            );
          })}

          {chartType === "area" ? (
            <>
              {geom.areaPath && <path d={geom.areaPath} fill={`url(#${meta.gradId})`} />}
              {geom.linePath && (
                <path
                  d={geom.linePath}
                  fill="none"
                  stroke={meta.color}
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </>
          ) : (
            geom.coords.map((pt, idx) => {
              const barH = Math.max(pt.value > 0 ? 3 : 0, baselineY - pt.y);
              const isActive = hoveredIdx === idx;
              return (
                <rect
                  key={pt.date}
                  x={pt.x - barW / 2}
                  y={baselineY - barH}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill={meta.color}
                  fillOpacity={isActive ? 1 : 0.72}
                />
              );
            })
          )}

          {/* Moving average dashed overlay */}
          {showMovingAvg && maPath && (
            <path
              d={maPath}
              fill="none"
              stroke="rgba(245,245,250,0.65)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Active crosshair */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={18}
              x2={activePoint.x}
              y2={baselineY}
              stroke="rgba(255,255,255,0.25)"
              strokeDasharray="2 3"
            />
          )}

          {/* Interactive hit targets + point dots */}
          {geom.coords.map((pt, idx) => {
            const isActive = hoveredIdx === idx;
            const hitW = geom.coords.length > 1 ? (width - 36) / geom.coords.length : 40;
            return (
              <g key={pt.date}>
                <rect
                  x={pt.x - hitW / 2}
                  y={0}
                  width={hitW}
                  height={height}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
                {chartType === "area" && (isActive || (pt.value > 0 && activeData.length <= 31)) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? 5 : 2.25}
                    fill={isActive ? "#f5f5fa" : meta.color}
                    stroke={meta.color}
                    strokeWidth={isActive ? 2.5 : 0}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* X-Axis Dates */}
        <div className="mt-1.5 flex items-center justify-between font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
          <span>
            {activeData[0] ? formatDateLabel(activeData[0].date, activeData[0].label, isFa) : ""}
          </span>
          <span>
            {activeData[Math.floor(activeData.length / 2)]
              ? formatDateLabel(
                  activeData[Math.floor(activeData.length / 2)].date,
                  activeData[Math.floor(activeData.length / 2)].label,
                  isFa
                )
              : ""}
          </span>
          <span>
            {activeData[activeData.length - 1]
              ? formatDateLabel(
                  activeData[activeData.length - 1].date,
                  activeData[activeData.length - 1].label,
                  isFa
                )
              : ""}
          </span>
        </div>
        </div>
      </div>

      {series === "pageviews" && totalCount === 0 && (
        <p className="mt-3 border-t border-(--color-border-subtle) pt-3 text-xs text-(--color-text-tertiary)">
          {isFa
            ? "ردیاب بازدید روزانه فعال است؛ به محض مطالعه مقالات توسط کاربران، نمودار زنده و تفکیک دستگاه‌ها به‌صورت خودکار پر می‌شود."
            : "Live daily view tracking is active. As readers open articles, daily views, device split, and referrer sources populate automatically."}
        </p>
      )}
    </section>
  );
}
