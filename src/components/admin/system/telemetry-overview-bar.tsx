"use client";

import {
  ArrowDown,
  ArrowUp,
  Clock,
  Gauge,
  GitCommitHorizontal,
  Network,
  Server,
} from "lucide-react";
import { formatBytesCompact, formatRateCompact } from "@/lib/system-updater-core";
import type { SystemTelemetrySnapshot } from "@/lib/system-telemetry";
import type { LocalGitStatus } from "@/lib/system-updater";

interface TelemetryOverviewBarProps {
  telemetry: SystemTelemetrySnapshot | null;
  localGit: LocalGitStatus | null;
  dbEngineFallback?: string;
  isFa: boolean;
  formatUptime: (sec: number, isFa: boolean) => string;
}

/**
 * 3x-ui-inspired secondary telemetry strip directly beneath the 4 radial gauges:
 * System Load (1m/5m/15m), live Network I/O throughput & cumulative totals,
 * Memory/Disk allocation bars, and Server Runtime / Uptime summary.
 */
export function TelemetryOverviewBar({
  telemetry,
  localGit,
  dbEngineFallback,
  isFa,
  formatUptime,
}: TelemetryOverviewBarProps) {
  const loadRatio = telemetry
    ? Math.min(100, (telemetry.cpu.loadAvg[0] / Math.max(1, telemetry.cpu.cores)) * 100)
    : 0;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
      <div className="grid grid-cols-1 divide-y divide-(--color-border-subtle) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
        {/* Col 1: System Load Average (1m / 5m / 15m) */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-(--color-text-secondary)">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Gauge className="h-3.5 w-3.5 text-sky-400" />
              {isFa ? "بار سیستم (Load)" : "System Load"}
            </span>
            <span dir="ltr" className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
              {telemetry ? `${telemetry.cpu.cores} vCPU` : "—"}
            </span>
          </div>

          <div
            dir="ltr"
            className="mt-2.5 flex items-baseline gap-2 font-[family-name:var(--font-mono)] text-sm font-semibold tabular-nums text-(--color-text-primary)"
          >
            {telemetry ? (
              <>
                <span>{telemetry.cpu.loadAvg[0].toFixed(2)}</span>
                <span className="text-(--color-text-tertiary)">/</span>
                <span className="text-(--color-text-secondary)">{telemetry.cpu.loadAvg[1].toFixed(2)}</span>
                <span className="text-(--color-text-tertiary)">/</span>
                <span className="text-(--color-text-tertiary)">{telemetry.cpu.loadAvg[2].toFixed(2)}</span>
              </>
            ) : (
              <span className="text-(--color-text-tertiary)">— / — / —</span>
            )}
          </div>

          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-deep)">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                loadRatio >= 85 ? "bg-red-500" : loadRatio >= 65 ? "bg-amber-400" : "bg-sky-400"
              }`}
              style={{ width: `${Math.max(2, loadRatio)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-(--color-text-tertiary)">
            {isFa ? "میانگین ۱، ۵ و ۱۵ دقیقه اخیر" : "1m · 5m · 15m load averages"}
          </p>
        </div>

        {/* Col 2: Live Network I/O Throughput & Totals (3x-ui signature block) */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-(--color-text-secondary)">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Network className="h-3.5 w-3.5 text-emerald-400" />
              {isFa ? "ترافیک شبکه (زنده)" : "Live Network I/O"}
            </span>
            <span dir="ltr" className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
              {telemetry ? `${telemetry.network.interfaceCount} NIC` : "—"}
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2 font-[family-name:var(--font-mono)] text-xs tabular-nums">
            <div dir="ltr" className="flex items-center gap-1 text-emerald-400">
              <ArrowDown className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-semibold">
                {telemetry ? formatRateCompact(telemetry.network.rxBytesPerSec) : "0 B/s"}
              </span>
            </div>
            <div dir="ltr" className="flex items-center gap-1 text-violet-400">
              <ArrowUp className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-semibold">
                {telemetry ? formatRateCompact(telemetry.network.txBytesPerSec) : "0 B/s"}
              </span>
            </div>
          </div>

          <p dir="ltr" className="mt-2.5 truncate font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
            {telemetry
              ? `RX ${formatBytesCompact(telemetry.network.totalRxBytes)} · TX ${formatBytesCompact(telemetry.network.totalTxBytes)}`
              : "RX — · TX —"}
          </p>
        </div>

        {/* Col 3: Capacity Breakdown (RAM / Swap / Disk Bars) */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-(--color-text-secondary)">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Server className="h-3.5 w-3.5 text-violet-400" />
              {isFa ? "ظرفیت حافظه و دیسک" : "Memory & Storage"}
            </span>
          </div>

          <div className="mt-2.5 space-y-2">
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-(--color-text-tertiary)">RAM</span>
                <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)">
                  {telemetry
                    ? `${formatBytesCompact(telemetry.memory.usedBytes)} / ${formatBytesCompact(telemetry.memory.totalBytes)}`
                    : "—"}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-deep)">
                <div
                  className="h-full rounded-full bg-violet-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(1, telemetry?.memory.percent ?? 0))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-(--color-text-tertiary)">{isFa ? "دیسک" : "Disk"}</span>
                <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)">
                  {telemetry
                    ? `${formatBytesCompact(telemetry.disk.usedBytes)} / ${formatBytesCompact(telemetry.disk.totalBytes)}`
                    : "—"}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-deep)">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(1, telemetry?.disk.percent ?? 0))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Col 4: Server Runtime & Uptime */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-(--color-text-secondary)">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-teal-400" />
              {isFa ? "آپتایم و محیط اجرا" : "Uptime & Runtime"}
            </span>
            <span dir="ltr" className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-(--color-text-primary)">
              {telemetry?.runtime.dbEngine ?? dbEngineFallback ?? "—"}
            </span>
          </div>

          <p className="mt-2.5 truncate font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-(--color-text-primary)">
            {telemetry ? formatUptime(telemetry.runtime.osUptimeSec, isFa) : "—"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-(--color-text-tertiary)">
            <span dir="ltr" className="font-[family-name:var(--font-mono)]">
              v{telemetry?.runtime.appVersion ?? "1.0.0"}
            </span>
            <span aria-hidden="true">·</span>
            <span dir="ltr" className="font-[family-name:var(--font-mono)]">
              Node {telemetry?.runtime.nodeVersion ?? "—"}
            </span>
            {localGit?.isGitRepo && localGit.currentCommitShort && (
              <>
                <span aria-hidden="true">·</span>
                <span dir="ltr" className="inline-flex items-center gap-0.5 font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
                  <GitCommitHorizontal className="h-3 w-3 text-(--color-accent-purple)" />
                  {localGit.currentBranch}@{localGit.currentCommitShort}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
