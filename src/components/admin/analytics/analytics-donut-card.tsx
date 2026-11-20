"use client";

import { useState } from "react";
import { buildDonutSegments, type DonutInputItem } from "@/lib/admin-analytics-pro";

interface AnalyticsDonutCardProps {
  title: string;
  subtitle?: string;
  items: DonutInputItem[];
  centerLabel: string;
  emptyText: string;
  isFa: boolean;
}

export function AnalyticsDonutCard({
  title,
  subtitle,
  items,
  centerLabel,
  emptyText,
}: AnalyticsDonutCardProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { segments, total, circumference } = buildDonutSegments(items, 42);
  const active = hoveredId ? segments.find((s) => s.id === hoveredId) ?? null : null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-(--color-text-primary)">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">{subtitle}</p>}
      </div>

      {total === 0 ? (
        <p className="py-4 text-xs text-(--color-text-tertiary)">{emptyText}</p>
      ) : (
        <div className="flex items-center gap-5">
          {/* Precision SVG Donut */}
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" role="img" aria-label={title}>
              <circle
                cx="52"
                cy="52"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="11"
              />
              {segments.map((seg) => {
                if (seg.dashLength <= 0) return null;
                const dimmed = hoveredId !== null && hoveredId !== seg.id;
                return (
                  <circle
                    key={seg.id}
                    cx="52"
                    cy="52"
                    r="42"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredId === seg.id ? 13 : 11}
                    strokeDasharray={`${seg.dashLength} ${circumference}`}
                    strokeDashoffset={seg.dashOffset}
                    opacity={dimmed ? 0.35 : 1}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredId(seg.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-[family-name:var(--font-mono)] text-base font-bold tabular-nums text-(--color-text-primary)">
                {active ? `${active.pct}%` : total.toLocaleString()}
              </span>
              <span className="max-w-[70px] truncate text-[10px] text-(--color-text-tertiary)">
                {active ? active.label : centerLabel}
              </span>
            </div>
          </div>

          {/* Clean Unboxed Legend */}
          <ul className="min-w-0 flex-1 space-y-2 text-xs">
            {segments.map((seg) => (
              <li
                key={seg.id}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="flex cursor-default items-center justify-between gap-2 rounded px-1 py-0.5 transition-colors hover:bg-white/[0.03]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="truncate text-(--color-text-secondary)">{seg.label}</span>
                </span>
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-primary)">
                  {seg.value.toLocaleString()}{" "}
                  <span className="text-(--color-text-tertiary)">({seg.pct}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
