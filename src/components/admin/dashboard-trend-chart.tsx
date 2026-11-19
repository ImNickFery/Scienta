"use client";

import { useState } from "react";
import { buildTrendSvgGeometry, type DailyTrendPoint } from "@/lib/admin-analytics";

interface DashboardTrendChartProps {
  activityTrend: DailyTrendPoint[];
  subscriberTrend: DailyTrendPoint[];
  rangeDays: number;
  isFa: boolean;
}

function formatTrendDate(isoDate: string, fallback: string, isFa: boolean): string {
  if (!isFa || !isoDate) return fallback;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(d);
}

export function DashboardTrendChart({
  activityTrend,
  subscriberTrend,
  rangeDays,
  isFa,
}: DashboardTrendChartProps) {
  const [series, setSeries] = useState<"activity" | "subscribers">("activity");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeData = series === "activity" ? activityTrend : subscriberTrend;
  const totalCount = activeData.reduce((sum, p) => sum + p.count, 0);
  const peakPoint = activeData.reduce(
    (best, p) => (p.count > best.count ? p : best),
    activeData[0] ?? { date: "", label: "-", count: 0 }
  );
  const peakLabel = formatTrendDate(peakPoint.date, peakPoint.label, isFa);

  const width = 680;
  const height = 210;
  const geom = buildTrendSvgGeometry(activeData, width, height, 14, 18);
  const strokeColor = series === "activity" ? "#7b3ffb" : "#ff7a00";
  const gradId = series === "activity" ? "trendGradActivity" : "trendGradSubs";

  const activePoint =
    hoveredIdx !== null && geom.coords[hoveredIdx] ? geom.coords[hoveredIdx] : null;

  const yMid = Math.round(geom.maxValue / 2);

  return (
    <section className="flex flex-col justify-between rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {isFa ? `روند فعالیت ${rangeDays} روز اخیر` : `${rangeDays}-Day Editorial & Audience Trend`}
          </h2>
          <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
            {series === "activity"
              ? isFa
                ? `${totalCount.toLocaleString()} رویداد ثبت‌شده · اوج: ${peakPoint.count.toLocaleString()} (${peakLabel})`
                : `${totalCount.toLocaleString()} recorded events · Peak: ${peakPoint.count.toLocaleString()} on ${peakLabel}`
              : isFa
                ? `${totalCount.toLocaleString()} مشترک جدید · اوج: ${peakPoint.count.toLocaleString()} (${peakLabel})`
                : `${totalCount.toLocaleString()} new subscribers · Peak: ${peakPoint.count.toLocaleString()} on ${peakLabel}`}
          </p>
        </div>

        {/* Interactive Series Switcher */}
        <div
          role="tablist"
          aria-label="Chart series"
          className="flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={series === "activity"}
            onClick={() => {
              setSeries("activity");
              setHoveredIdx(null);
            }}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
              series === "activity"
                ? "bg-(--color-accent-purple) text-white"
                : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            }`}
          >
            {isFa ? "رویدادها و API" : "Activity & API"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={series === "subscribers"}
            onClick={() => {
              setSeries("subscribers");
              setHoveredIdx(null);
            }}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
              series === "subscribers"
                ? "bg-(--color-accent-orange) text-black"
                : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            }`}
          >
            {isFa ? "مشترکین جدید" : "Subscribers"}
          </button>
        </div>
      </div>

      {/* Interactive SVG Area Chart */}
      <div className="relative mt-5" dir="ltr">
        {/* Floating hover readout bar (keeps zero layout shift) */}
        <div className="mb-2 flex h-5 items-center justify-between text-[11px] font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-tertiary)">
          <span>
            {activePoint
              ? isFa
                ? formatTrendDate(activePoint.date, activePoint.label, true)
                : `${activePoint.label} (${activePoint.date})`
              : isFa
                ? "برای جزئیات روزانه روی نمودار حرکت کنید"
                : "Hover chart points to inspect daily counts"}
          </span>
          <span className="font-semibold text-(--color-text-primary)">
            {activePoint
              ? `${activePoint.value.toLocaleString()} ${series === "activity" ? (isFa ? "رویداد" : "events") : isFa ? "مشترک" : "subs"}`
              : `${isFa ? "مجموع" : "Total"}: ${totalCount.toLocaleString()}`}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-52 w-full overflow-visible"
          role="img"
          aria-label={`${rangeDays}-day ${series} trend chart`}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal reference gridlines */}
          {[0, 0.5, 1].map((fraction, i) => {
            const y = 18 + (height - 36) * fraction;
            const tickVal = fraction === 0 ? geom.maxValue : fraction === 0.5 ? yMid : 0;
            return (
              <g key={i}>
                <line
                  x1={14}
                  y1={y}
                  x2={width - 14}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray={fraction === 1 ? undefined : "3 4"}
                />
                <text
                  x={width - 14}
                  y={y - 4}
                  textAnchor="end"
                  fill="#7a7a92"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Area fill & stroke line */}
          {geom.areaPath && <path d={geom.areaPath} fill={`url(#${gradId})`} />}
          {geom.linePath && (
            <path
              d={geom.linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Active crosshair */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={14}
              x2={activePoint.x}
              y2={height - 18}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="2 3"
            />
          )}

          {/* Interactive hit targets + point markers */}
          {geom.coords.map((pt, idx) => {
            const isActive = hoveredIdx === idx;
            const hitW = geom.coords.length > 1 ? (width - 28) / geom.coords.length : 40;
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
                {(isActive || pt.value > 0) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? 5 : 2.5}
                    fill={isActive ? "#f5f5fa" : strokeColor}
                    stroke={strokeColor}
                    strokeWidth={isActive ? 2.5 : 0}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* X-Axis labels */}
        <div className="mt-1.5 flex items-center justify-between font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
          <span>
            {activeData[0] ? formatTrendDate(activeData[0].date, activeData[0].label, isFa) : ""}
          </span>
          <span>
            {activeData[Math.floor(activeData.length / 2)]
              ? formatTrendDate(
                  activeData[Math.floor(activeData.length / 2)].date,
                  activeData[Math.floor(activeData.length / 2)].label,
                  isFa
                )
              : ""}
          </span>
          <span>
            {activeData[activeData.length - 1]
              ? formatTrendDate(
                  activeData[activeData.length - 1].date,
                  activeData[activeData.length - 1].label,
                  isFa
                )
              : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
