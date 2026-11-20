"use client";

import { useState } from "react";
import type { HeatmapCell } from "@/lib/admin-analytics-pro";

interface AnalyticsHeatmapProps {
  cells: HeatmapCell[];
  total: number;
  peak: number;
  activeDays: number;
  isFa: boolean;
}

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-white/[0.05]",
  1: "bg-(--color-accent-purple)/30",
  2: "bg-(--color-accent-purple)/55",
  3: "bg-(--color-accent-purple)/80",
  4: "bg-(--color-accent-orange)",
};

const WEEKDAY_LABELS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_LABELS_FA = ["ی", "د", "س", "چ", "پ", "ج", "ش"];

function formatHeatmapDate(iso: string, isFa: boolean): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(isFa ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatMonthTick(iso: string | undefined, isFa: boolean): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(isFa ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function AnalyticsHeatmap({ cells, total, peak, activeDays, isFa }: AnalyticsHeatmapProps) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  // Organize cells into columns of 7 days (12 weeks)
  const columns: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    columns.push(cells.slice(i, i + 7));
  }

  const firstWeek = columns[0] ?? [];
  const rowLabels = firstWeek.map((c) =>
    isFa ? WEEKDAY_LABELS_FA[c.dayOfWeek] : WEEKDAY_LABELS_EN[c.dayOfWeek]
  );

  return (
    <section className="flex h-full flex-col justify-between rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {isFa ? "نقشه حرارتی فعالیت ۱۲ هفته اخیر" : "12-Week Editorial Cadence Heatmap"}
          </h2>
          <p className="mt-0.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${total.toLocaleString()} رویداد در ${activeDays} روز فعال · بیشترین روز: ${peak}`
              : `${total.toLocaleString()} events across ${activeDays} active days · Peak day: ${peak}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-(--color-text-tertiary)">
          <span>{isFa ? "کم" : "Less"}</span>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <span key={lvl} className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_CLASSES[lvl]}`} />
          ))}
          <span>{isFa ? "زیاد" : "More"}</span>
        </div>
      </div>

      {/* Zero-CLS live hover readout */}
      <div className="mt-4 flex h-5 items-center justify-between font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
        <span>
          {hovered
            ? formatHeatmapDate(hovered.date, isFa)
            : isFa
              ? "برای مشاهده جزئیات روز، روی هر خانه بروید"
              : "Hover any cell to inspect daily activity"}
        </span>
        <span className="font-semibold text-(--color-text-primary)">
          {hovered
            ? isFa
              ? `${hovered.count.toLocaleString()} رویداد`
              : `${hovered.count.toLocaleString()} events`
            : `${cells.length} ${isFa ? "روز" : "days"}`}
        </span>
      </div>

      {/* Full-width Fluid 12x7 Calendar Matrix with Weekday Index */}
      <div className="mt-3 overflow-x-auto pb-1" dir="ltr">
        <div className="flex min-w-[360px] items-stretch gap-2.5">
          {/* Weekday rail */}
          <div className="grid shrink-0 grid-rows-7 gap-1.5 py-0.5 text-center font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)">
            {rowLabels.map((lbl, idx) => (
              <span key={idx} className="flex items-center justify-center leading-none">
                {idx % 2 === 0 ? lbl : ""}
              </span>
            ))}
          </div>

          {/* 12 equal week columns spanning full card width */}
          <div className="grid flex-1 grid-cols-12 gap-1.5">
            {columns.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-rows-7 gap-1.5">
                {week.map((cell) => (
                  <button
                    key={cell.date}
                    type="button"
                    onMouseEnter={() => setHovered(cell)}
                    onFocus={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${cell.date}: ${cell.count} events`}
                    className={`aspect-square w-full max-h-6 rounded-[4px] transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-(--color-accent-purple) ${
                      LEVEL_CLASSES[cell.level]
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Span Markers */}
        <div className="mt-2.5 flex items-center justify-between ps-6 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-(--color-text-tertiary)">
          <span>{formatMonthTick(cells[0]?.date, isFa)}</span>
          <span>{formatMonthTick(cells[Math.floor(cells.length / 2)]?.date, isFa)}</span>
          <span>{formatMonthTick(cells[cells.length - 1]?.date, isFa)}</span>
        </div>
      </div>
    </section>
  );
}
