"use client";

import { useState } from "react";
import { Globe2, MapPin } from "lucide-react";
import type { CountryIntelligenceItem, RegionCode, TrafficChannel } from "@/lib/visitor-telemetry";

interface VisitorGeoMapProps {
  countries: CountryIntelligenceItem[];
  regions: Array<{ code: RegionCode; pageviews: number; visitors: number; share: number }>;
  activeCountry: string | null;
  onSelectCountry: (code: string | null) => void;
  isFa: boolean;
}

const REGION_NAMES: Record<RegionCode, { en: string; fa: string; color: string }> = {
  ME: { en: "Middle East", fa: "خاورمیانه", color: "#8b5cf6" },
  EU: { en: "Europe", fa: "اروپا", color: "#38bdf8" },
  NA: { en: "North America", fa: "آمریکای شمالی", color: "#10b981" },
  AS: { en: "Asia", fa: "آسیا", color: "#f59e0b" },
  OC: { en: "Oceania", fa: "اقیانوسیه", color: "#ec4899" },
  SA: { en: "South America", fa: "آمریکای جنوبی", color: "#06b6d4" },
  AF: { en: "Africa", fa: "آفریقا", color: "#a855f7" },
  UN: { en: "Unresolved", fa: "نامشخص", color: "#64748b" },
};

const CHANNEL_SHORT: Record<TrafficChannel, { en: string; fa: string }> = {
  search: { en: "Search", fa: "جستجو" },
  ai_search: { en: "AI Search", fa: "هوش مصنوعی" },
  direct: { en: "Direct", fa: "مستقیم" },
  social: { en: "Social", fa: "شبکه اجتماعی" },
  referral: { en: "Referral", fa: "ارجاع" },
  campaign: { en: "Campaign", fa: "کمپین" },
};

// Simplified clean stylized world landmass paths in 960x440 equirectangular projection (lon -180..180, lat 80..-60)
function projectLonLat(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * 960;
  const clampedLat = Math.max(-60, Math.min(80, lat));
  const y = ((80 - clampedLat) / 140) * 440;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

const CONTINENT_SILHOUETTES = [
  // North America
  "M 70,58 L 160,36 L 260,55 L 312,92 L 296,136 L 265,165 L 222,195 L 210,224 L 182,216 L 154,185 L 122,148 L 88,108 Z",
  // Greenland
  "M 312,26 L 374,20 L 392,52 L 355,74 L 320,62 Z",
  // South America
  "M 232,232 L 284,234 L 328,274 L 336,314 L 304,368 L 274,405 L 254,394 L 246,340 L 228,284 Z",
  // Europe
  "M 442,60 L 496,44 L 552,48 L 578,76 L 560,114 L 522,126 L 474,126 L 444,108 L 434,84 Z",
  // UK & Ireland
  "M 432,76 L 448,74 L 452,96 L 434,98 Z",
  // Africa
  "M 446,144 L 528,140 L 574,174 L 606,216 L 594,274 L 564,334 L 528,354 L 498,320 L 478,266 L 436,216 L 430,176 Z",
  // Middle East & Arabian Peninsula
  "M 560,132 L 622,132 L 642,164 L 616,196 L 578,188 L 562,158 Z",
  // Asia (Mainland + Russia + India + SE Asia)
  "M 572,56 L 690,42 L 820,52 L 884,82 L 856,126 L 814,158 L 780,196 L 748,224 L 716,204 L 686,218 L 656,184 L 624,152 L 580,124 L 564,90 Z",
  // Japan
  "M 840,122 L 858,118 L 860,148 L 842,156 Z",
  // Indonesia / Archipelago
  "M 744,244 L 826,248 L 832,262 L 750,258 Z",
  // Australia & NZ
  "M 786,294 L 864,290 L 884,332 L 856,368 L 792,358 L 774,324 Z",
  "M 908,358 L 924,354 L 922,382 L 906,384 Z",
];

export function VisitorGeoMap({
  countries,
  regions,
  activeCountry,
  onSelectCountry,
  isFa,
}: VisitorGeoMapProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const mappableCountries = countries.filter((c) => c.code !== "ZZ");
  const maxViews = Math.max(1, ...countries.map((c) => c.pageviews));
  const hoveredCountry =
    hoveredCode !== null ? countries.find((c) => c.code === hoveredCode) ?? null : null;

  return (
    <section
      aria-label={isFa ? "توزیع جغرافیایی و نقشه کشورها" : "Geographic distribution and world map"}
      className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-(--color-accent-purple)" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "تفکیک جغرافیایی و کشورهای بازدیدکننده" : "Geographic Distribution & Countries"}
            </h2>
          </div>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "برای فیلتر کردن کل داشبورد آماری، روی هر کشور در نقشه یا جدول کلیک کنید"
              : "Click any country on the map or table to cross-filter the entire analytics view"}
          </p>
        </div>

        {/* Regional summary strip */}
        {regions.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--color-text-tertiary)">
            {regions.slice(0, 4).map((r) => {
              const info = REGION_NAMES[r.code];
              return (
                <span key={r.code} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="h-2 w-2 rounded-xs"
                    style={{ backgroundColor: info.color }}
                  />
                  <span>{isFa ? info.fa : info.en}</span>
                  <span className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)">
                    {r.share}%
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-12">
        {/* Interactive Vector Telemetry World Map */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3 lg:col-span-7">
          <div className="flex h-6 items-center justify-between text-[11px] font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-tertiary)">
            {hoveredCountry ? (
              <span className="flex items-center gap-2 text-(--color-text-primary)">
                <MapPin className="h-3 w-3 text-(--color-accent-purple)" />
                <span>
                  {isFa ? hoveredCountry.nameFa : hoveredCountry.nameEn} ({hoveredCountry.code})
                  {hoveredCountry.topCity ? ` · ${hoveredCountry.topCity}` : ""}
                </span>
              </span>
            ) : (
              <span>
                {isFa
                  ? `${mappableCountries.length.toLocaleString()} کشور فعال در بازه انتخابی`
                  : `${mappableCountries.length.toLocaleString()} active countries in window`}
              </span>
            )}
            {hoveredCountry ? (
              <span className="text-[#38bdf8]">
                {hoveredCountry.pageviews.toLocaleString()} {isFa ? "بازدید" : "views"} ·{" "}
                {hoveredCountry.visitors.toLocaleString()} {isFa ? "کاربر" : "visitors"} (
                {hoveredCountry.share}%)
              </span>
            ) : (
              <span>
                {activeCountry
                  ? isFa
                    ? `فیلتر فعال: ${activeCountry}`
                    : `Filtered: ${activeCountry}`
                  : isFa
                    ? "تشخیص از هدر GeoIP + منطقه زمانی"
                    : "Edge GeoIP + Timezone resolution"}
              </span>
            )}
          </div>

          <svg
            viewBox="0 0 960 440"
            className="mt-2 h-[250px] w-full select-none sm:h-[280px]"
            role="img"
            aria-label={isFa ? "نقشه جهانی بازدیدکنندگان" : "World visitor map"}
          >
            {/* Subtle lat/lon graticule */}
            {[110, 220, 330].map((y) => (
              <line
                key={`lat-${y}`}
                x1={0}
                y1={y}
                x2={960}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="3 5"
              />
            ))}
            {[160, 320, 480, 640, 800].map((x) => (
              <line
                key={`lon-${x}`}
                x1={x}
                y1={0}
                x2={x}
                y2={440}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="3 5"
              />
            ))}

            {/* Stylized world continents */}
            <g fill="rgba(255,255,255,0.055)" stroke="rgba(255,255,255,0.10)" strokeWidth="1">
              {CONTINENT_SILHOUETTES.map((d, i) => (
                <path key={i} d={d} strokeLinejoin="round" />
              ))}
            </g>

            {/* Country telemetry nodes */}
            {mappableCountries.map((c) => {
              const { x, y } = projectLonLat(c.lon, c.lat);
              const ratio = c.pageviews / maxViews;
              const radius = 5 + Math.sqrt(ratio) * 14;
              const isSelected = activeCountry === c.code;
              const isHovered = hoveredCode === c.code;
              const nodeColor = REGION_NAMES[c.region]?.color || "#8b5cf6";

              return (
                <g
                  key={c.code}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredCode(c.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                  onClick={() => onSelectCountry(isSelected ? null : c.code)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${isFa ? c.nameFa : c.nameEn}: ${c.pageviews} pageviews`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectCountry(isSelected ? null : c.code);
                    }
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + (isSelected || isHovered ? 5 : 3)}
                    fill={nodeColor}
                    fillOpacity={isSelected ? 0.34 : isHovered ? 0.25 : 0.14}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={nodeColor}
                    fillOpacity={isSelected ? 0.95 : 0.8}
                    stroke={isSelected || isHovered ? "#ffffff" : "rgba(12,14,22,0.8)"}
                    strokeWidth={isSelected || isHovered ? 2 : 1.2}
                  />
                  {(isSelected || isHovered || ratio >= 0.35) && (
                    <text
                      x={x}
                      y={y - radius - 6}
                      textAnchor="middle"
                      fill="#e4e4f0"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="var(--font-mono)"
                    >
                      {c.code}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Ranked Country Breakdown Table */}
        <div className="flex min-w-0 flex-col justify-between lg:col-span-5">
          {countries.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-(--color-border-subtle) px-4 py-12 text-center">
              <p className="text-xs font-medium text-(--color-text-secondary)">
                {isFa ? "هنوز ترافیک جغرافیایی در این بازه ثبت نشده است." : "No geographic traffic recorded in this window yet."}
              </p>
              <p className="mt-1.5 max-w-xs text-[11px] text-(--color-text-tertiary)">
                {isFa
                  ? "با ورود اولین بازدیدکننده به صفحات سایت، کشور و شهر به‌صورت خودکار تفکیک می‌شود."
                  : "Country and region attribution starts automatically as visitors load public pages."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto pr-1" style={{ maxHeight: 320 }}>
              {countries.slice(0, 12).map((c) => {
                const isSelected = activeCountry === c.code;
                const widthPct = Math.max(4, Math.round((c.pageviews / maxViews) * 100));
                const regionColor = REGION_NAMES[c.region]?.color || "#8b5cf6";
                const channelLabel = CHANNEL_SHORT[c.topChannel] || CHANNEL_SHORT.direct;

                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onSelectCountry(isSelected ? null : c.code)}
                    onMouseEnter={() => setHoveredCode(c.code)}
                    onMouseLeave={() => setHoveredCode(null)}
                    className={`group block w-full rounded-lg border px-3 py-2.5 text-start transition-colors ${
                      isSelected
                        ? "border-(--color-accent-purple) bg-(--color-accent-purple)/12"
                        : "border-transparent bg-white/[0.02] hover:border-(--color-border-subtle) hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-6 shrink-0 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-(--color-text-tertiary)">
                          {c.code}
                        </span>
                        <span className="truncate font-medium text-(--color-text-primary)">
                          {isFa ? c.nameFa : c.nameEn}
                        </span>
                        {c.topCity && (
                          <span className="hidden truncate text-[11px] text-(--color-text-tertiary) sm:inline">
                            · {c.topCity}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                        {c.visitors.toLocaleString()}{" "}
                        <span className="text-(--color-text-tertiary)">
                          / {c.pageviews.toLocaleString()} ({c.share}%)
                        </span>
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${widthPct}%`, backgroundColor: regionColor }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] text-(--color-text-tertiary)">
                        {isFa ? channelLabel.fa : channelLabel.en}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {countries.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-(--color-border-subtle) pt-2.5 text-[11px] text-(--color-text-tertiary)">
              <span>
                {isFa ? "فرمت اعداد: کاربران یکتا / بازدید صفحه" : "Format: unique visitors / pageviews"}
              </span>
              {activeCountry && (
                <button
                  type="button"
                  onClick={() => onSelectCountry(null)}
                  className="font-medium text-(--color-accent-purple) hover:underline"
                >
                  {isFa ? "حذف فیلتر کشور" : "Clear country"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
