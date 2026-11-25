"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Cpu, Globe, Laptop, MonitorSmartphone } from "lucide-react";
import { AnalyticsDonutCard } from "./analytics-donut-card";
import type {
  HourlyBucket,
  RankedDimensionItem,
  RecentVisitorHit,
} from "@/lib/visitor-telemetry";

interface VisitorTechPanelProps {
  browsers: RankedDimensionItem[];
  browserVersions: RankedDimensionItem[];
  operatingSystems: RankedDimensionItem[];
  osVersions: RankedDimensionItem[];
  devices: RankedDimensionItem[];
  deviceVendors: RankedDimensionItem[];
  screenBuckets: RankedDimensionItem[];
  languages: RankedDimensionItem[];
  topPages: Array<{ path: string; locale: string; pageviews: number; visitors: number; share: number }>;
  hourlyDistribution: HourlyBucket[];
  recentHits: RecentVisitorHit[];
  activeBrowser: string | null;
  activeOs: string | null;
  activeDevice: string | null;
  onSelectBrowser: (browser: string | null) => void;
  onSelectOs: (os: string | null) => void;
  onSelectDevice: (device: string | null) => void;
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

function formatHitTime(raw: string, isFa: boolean): string {
  const d = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(isFa ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VisitorTechPanel({
  browsers,
  browserVersions,
  operatingSystems,
  osVersions,
  devices,
  deviceVendors,
  screenBuckets,
  languages,
  topPages,
  hourlyDistribution,
  recentHits,
  activeBrowser,
  activeOs,
  activeDevice,
  onSelectBrowser,
  onSelectOs,
  onSelectDevice,
  isFa,
}: VisitorTechPanelProps) {
  const [browserView, setBrowserView] = useState<"family" | "version">("family");
  const [osView, setOsView] = useState<"family" | "version">("family");
  const hydrated = useIsHydrated();

  const shownBrowsers = browserView === "family" ? browsers : browserVersions;
  const shownOs = osView === "family" ? operatingSystems : osVersions;
  const maxBrowser = Math.max(1, ...shownBrowsers.map((b) => b.pageviews));
  const maxOs = Math.max(1, ...shownOs.map((o) => o.pageviews));
  const maxVendor = Math.max(1, ...deviceVendors.map((v) => v.pageviews));
  const maxScreen = Math.max(1, ...screenBuckets.map((s) => s.pageviews));

  const deviceColorMap: Record<string, string> = {
    desktop: "#38bdf8",
    mobile: "#8b5cf6",
    tablet: "#ff7a00",
  };
  const donutDevices = devices.map((d) => ({
    id: d.key,
    label: isFa ? d.labelFa || d.label : d.label,
    value: d.pageviews,
    color: deviceColorMap[d.key] || "#8b5cf6",
  }));

  return (
    <div className="space-y-6">
      {/* Row 1: Browsers + Operating Systems */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Browsers */}
        <section
          aria-label={isFa ? "تفکیک مرورگرها" : "Browser breakdown"}
          className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-(--color-accent-purple)" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "مرورگرهای بازدیدکنندگان" : "Browsers"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div
                role="tablist"
                aria-label={isFa ? "نحوه نمایش مرورگرها" : "Browser grouping"}
                className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-[11px]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={browserView === "family"}
                  onClick={() => setBrowserView("family")}
                  className={`rounded-md px-2 py-1 font-medium whitespace-nowrap ${
                    browserView === "family"
                      ? "bg-white/[0.12] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? "مرورگر" : "Browser"}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={browserView === "version"}
                  onClick={() => setBrowserView("version")}
                  className={`rounded-md px-2 py-1 font-medium whitespace-nowrap ${
                    browserView === "version"
                      ? "bg-white/[0.12] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? "نسخه دقیق" : "Versions"}
                </button>
              </div>
              {activeBrowser && (
                <button
                  type="button"
                  onClick={() => onSelectBrowser(null)}
                  className="text-xs font-medium text-(--color-accent-purple) hover:underline"
                >
                  {isFa ? "پاک" : "Clear"}
                </button>
              )}
            </div>
          </div>

          {shownBrowsers.length === 0 ? (
            <p className="mt-6 py-8 text-center text-xs text-(--color-text-tertiary)">
              {isFa ? "هنوز اطلاعات مرورگری ثبت نشده است." : "No browser data recorded yet."}
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {shownBrowsers.map((b) => {
                const familyKey = browserView === "family" ? b.key : b.sublabel || b.key;
                const selected = activeBrowser === familyKey;
                const widthPct = Math.max(4, Math.round((b.pageviews / maxBrowser) * 100));

                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => onSelectBrowser(selected ? null : familyKey)}
                    className={`block w-full rounded-lg border px-3 py-2 text-start transition-colors ${
                      selected
                        ? "border-(--color-accent-purple) bg-(--color-accent-purple)/12"
                        : "border-transparent bg-white/[0.02] hover:border-(--color-border-subtle) hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-(--color-text-primary)">
                        {b.label}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                        {b.visitors.toLocaleString()} {isFa ? "کاربر" : "users"} ·{" "}
                        {b.pageviews.toLocaleString()} ({b.share}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#8b5cf6]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Operating Systems */}
        <section
          aria-label={isFa ? "تفکیک سیستم‌عامل‌ها" : "Operating system breakdown"}
          className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "سیستم‌عامل‌ها" : "Operating Systems"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div
                role="tablist"
                aria-label={isFa ? "نحوه نمایش سیستم‌عامل" : "OS grouping"}
                className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-[11px]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={osView === "family"}
                  onClick={() => setOsView("family")}
                  className={`rounded-md px-2 py-1 font-medium whitespace-nowrap ${
                    osView === "family"
                      ? "bg-white/[0.12] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? "سیستم‌عامل" : "OS"}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={osView === "version"}
                  onClick={() => setOsView("version")}
                  className={`rounded-md px-2 py-1 font-medium whitespace-nowrap ${
                    osView === "version"
                      ? "bg-white/[0.12] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? "نسخه دقیق" : "Versions"}
                </button>
              </div>
              {activeOs && (
                <button
                  type="button"
                  onClick={() => onSelectOs(null)}
                  className="text-xs font-medium text-(--color-accent-purple) hover:underline"
                >
                  {isFa ? "پاک" : "Clear"}
                </button>
              )}
            </div>
          </div>

          {shownOs.length === 0 ? (
            <p className="mt-6 py-8 text-center text-xs text-(--color-text-tertiary)">
              {isFa ? "هنوز اطلاعات سیستم‌عاملی ثبت نشده است." : "No OS data recorded yet."}
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {shownOs.map((o) => {
                const familyKey = osView === "family" ? o.key : o.sublabel || o.key;
                const selected = activeOs === familyKey;
                const widthPct = Math.max(4, Math.round((o.pageviews / maxOs) * 100));

                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => onSelectOs(selected ? null : familyKey)}
                    className={`block w-full rounded-lg border px-3 py-2 text-start transition-colors ${
                      selected
                        ? "border-(--color-accent-purple) bg-(--color-accent-purple)/12"
                        : "border-transparent bg-white/[0.02] hover:border-(--color-border-subtle) hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-(--color-text-primary)">
                        {o.label}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                        {o.visitors.toLocaleString()} {isFa ? "کاربر" : "users"} ·{" "}
                        {o.pageviews.toLocaleString()} ({o.share}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#38bdf8]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Row 2: Device Class + Hardware Vendors + Screen Sizes */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Device Class */}
        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-[#10b981]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "نوع دستگاه" : "Device Form Factor"}
              </h2>
            </div>
            {activeDevice && (
              <button
                type="button"
                onClick={() => onSelectDevice(null)}
                className="text-xs font-medium text-(--color-accent-purple) hover:underline"
              >
                {isFa ? "پاک" : "Clear"}
              </button>
            )}
          </div>

          <div className="mt-4">
            <AnalyticsDonutCard
              title=""
              items={donutDevices}
              centerLabel={isFa ? "بازدید" : "views"}
              emptyText={isFa ? "هنوز داده‌ای ثبت نشده است." : "No device data yet."}
              isFa={isFa}
            />
          </div>

          {devices.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-(--color-border-subtle) pt-3">
              {devices.map((d) => {
                const selected = activeDevice === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onSelectDevice(selected ? null : d.key)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      selected
                        ? "border-(--color-accent-purple) bg-(--color-accent-purple) text-white"
                        : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:text-(--color-text-primary)"
                    }`}
                  >
                    {isFa ? d.labelFa || d.label : d.label} ({d.share}%)
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Hardware Vendors */}
        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-(--color-text-secondary)" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "برند و سازنده سخت‌افزار" : "Hardware Vendors"}
            </h2>
          </div>
          {deviceVendors.length === 0 ? (
            <p className="mt-5 text-xs text-(--color-text-tertiary)">
              {isFa ? "هنوز داده‌ای ثبت نشده است." : "No vendor signals yet."}
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {deviceVendors.slice(0, 7).map((v) => {
                const widthPct = Math.max(4, Math.round((v.pageviews / maxVendor) * 100));
                return (
                  <div key={v.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-(--color-text-primary)">
                        {v.label}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                        {v.pageviews.toLocaleString()} ({v.share}%)
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-emerald-400/80"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Screen Width Buckets & Browser Languages */}
        <section className="flex flex-col justify-between gap-5 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <div>
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "ابعاد نمایشگر" : "Screen Resolution Tiers"}
            </h2>
            {screenBuckets.length === 0 ? (
              <p className="mt-3 text-xs text-(--color-text-tertiary)">
                {isFa ? "داده‌ای ثبت نشده است." : "No screen telemetry yet."}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {screenBuckets.map((s) => {
                  const widthPct = Math.max(4, Math.round((s.pageviews / maxScreen) * 100));
                  return (
                    <div key={s.key} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                          {s.label}
                        </span>
                        <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-primary)">
                          {s.share}%
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-amber-400/80"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-(--color-border-subtle) pt-4">
            <h3 className="text-xs font-semibold text-(--color-text-primary)">
              {isFa ? "زبان مرورگر بازدیدکنندگان" : "Browser Languages"}
            </h3>
            {languages.length === 0 ? (
              <p className="mt-2 text-xs text-(--color-text-tertiary)">—</p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                {languages.slice(0, 6).map((lang) => (
                  <span key={lang.key}>
                    {lang.label}{" "}
                    <span className="text-(--color-text-tertiary)">({lang.share}%)</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Row 3: 24-Hour Traffic Rhythm + Top Visited Paths */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 lg:col-span-7">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-(--color-accent-purple)" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "ریتم ساعتی ترافیک (۲۴ ساعت UTC)" : "24-Hour Traffic Rhythm (UTC)"}
            </h2>
          </div>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "ساعات اوج مطالعه کاربران برای زمان‌بندی دقیق انتشار مقالات و خبرنامه"
              : "Peak reading hours across the day for optimal publishing and newsletter timing"}
          </p>
          <div className="mt-4 h-[210px] w-full min-w-0" dir="ltr">
            {hydrated && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={hourlyDistribution} margin={{ top: 8, right: 8, left: -16, bottom: 2 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#7a7a92", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#7a7a92", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
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
                  <Bar
                    dataKey="pageviews"
                    name={isFa ? "بازدید" : "Pageviews"}
                    fill="#8b5cf6"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 lg:col-span-5">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {isFa ? "پربازدیدترین صفحات (مسیرهای زنده)" : "Top Visited Paths"}
          </h2>
          {topPages.length === 0 ? (
            <p className="mt-6 text-xs text-(--color-text-tertiary)">
              {isFa ? "هنوز مسیری در این بازه ثبت نشده است." : "No visited paths recorded yet."}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-(--color-border-subtle)">
              {topPages.slice(0, 8).map((p) => (
                <div key={p.path} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span
                    dir="ltr"
                    className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-primary)"
                    title={p.path}
                  >
                    {p.path}
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                    {p.pageviews.toLocaleString()}{" "}
                    <span className="text-(--color-text-tertiary)">({p.share}%)</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Row 4: Live Privacy-Safe Recent Visits Stream */}
      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--color-border-subtle) px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "جریان آخرین بازدیدهای ثبت‌شده (بدون ذخیره IP)" : "Recent Tracked Visits (Privacy-Safe Stream)"}
            </h2>
            <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
              {isFa
                ? "نمایش دقیق کشور، منبع ورودی، موتور جستجو، مرورگر، سیستم‌عامل و نوع دستگاه برای ۲۵ بازدید اخیر"
                : "Latest 25 tracked pageviews with country, acquisition source, browser, OS, and device class"}
            </p>
          </div>
          <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {recentHits.length} {isFa ? "رکورد" : "events"}
          </span>
        </div>

        <div className="overflow-x-auto">
          {recentHits.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-(--color-text-tertiary)">
              {isFa
                ? "هنوز بازدید زنده‌ای در این بازه ثبت نشده است."
                : "No live tracked visits match the current filter."}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-(--color-border-subtle) text-[11px] text-(--color-text-tertiary)">
                  <th className="px-5 py-3 text-start font-medium">{isFa ? "زمان" : "Time"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isFa ? "صفحه" : "Page"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isFa ? "کشور / شهر" : "Country / City"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isFa ? "منبع / جستجو" : "Source / Engine"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isFa ? "مرورگر" : "Browser"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isFa ? "سیستم‌عامل" : "OS"}</th>
                  <th className="px-5 py-3 text-end font-medium">{isFa ? "دستگاه" : "Device"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border-subtle)">
                {recentHits.map((hit, idx) => (
                  <tr key={`${hit.createdAt}-${hit.path}-${idx}`} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary) whitespace-nowrap">
                      {formatHitTime(hit.createdAt, isFa)}
                    </td>
                    <td className="max-w-[220px] px-4 py-2.5">
                      <span
                        dir="ltr"
                        className="block truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-primary)"
                        title={hit.path}
                      >
                        {hit.path}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-(--color-text-secondary)">
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                        {hit.countryCode}
                      </span>{" "}
                      {isFa ? hit.countryNameFa : hit.countryNameEn}
                      {hit.city ? (
                        <span className="text-(--color-text-tertiary)"> · {hit.city}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-(--color-text-secondary)">
                      {hit.searchEngine ? (
                        <span className="font-medium text-(--color-accent-purple)">
                          {hit.searchEngine}
                        </span>
                      ) : (
                        <span className="font-[family-name:var(--font-mono)] text-[11px]">
                          {hit.referrerHost}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-(--color-text-secondary)">
                      {hit.browser}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-(--color-text-secondary)">
                      {hit.os}
                    </td>
                    <td className="px-5 py-2.5 text-end whitespace-nowrap font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                      {hit.deviceType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
