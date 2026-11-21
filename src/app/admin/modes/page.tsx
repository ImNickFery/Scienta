"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Aperture,
  Check,
  Compass,
  ExternalLink,
  Loader2,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  AlertCircle,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminLocale } from "@/components/admin/admin-locale-context";
import {
  DEFAULT_SITE_MODES,
  SITE_COLOR_SCHEMES,
  SITE_DESIGN_MODES,
  SITE_THEMES,
  type AmbientMode,
  type ColorScheme,
  type ContrastMode,
  type DesignMode,
  type SiteDesignModeDefinition,
  type SiteModesConfig,
  type SiteThemeDefinition,
  type SiteThemeId,
} from "@/lib/site-modes";

function applyModesToDocument(modes: SiteModesConfig) {
  const root = document.documentElement;
  root.dataset.siteTheme = modes.applyToAdmin ? modes.theme : "aurora";
  root.dataset.ambientMode = modes.ambientMode;
  root.dataset.contrastMode = modes.contrastMode;
}

function formatUpdatedAt(raw: string | null, isFa: boolean): string | null {
  if (!raw) return null;
  const parsed = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(isFa ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSiteModesPage() {
  const { isFa, locale } = useAdminLocale();
  const [modes, setModes] = useState<SiteModesConfig>(DEFAULT_SITE_MODES);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchInitialModes() {
      try {
        const data = await adminFetch<{ modes: SiteModesConfig; updatedAt: string | null }>(
          "/api/admin/site-modes"
        );
        if (cancelled) return;
        setModes(data.modes);
        setUpdatedAt(data.updatedAt);
        applyModesToDocument(data.modes);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load site modes"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchInitialModes();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistModes(next: SiteModesConfig, successFa: string, successEn: string) {
    const previous = modes;
    setModes(next);
    applyModesToDocument(next);
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const res = await adminFetch<{ modes: SiteModesConfig; updatedAt: string }>(
        "/api/admin/site-modes",
        {
          method: "PUT",
          body: JSON.stringify(next),
        }
      );
      setModes(res.modes);
      setUpdatedAt(res.updatedAt);
      applyModesToDocument(res.modes);
      setStatusMessage(isFa ? successFa : successEn);
    } catch (err) {
      setModes(previous);
      applyModesToDocument(previous);
      setError(
        err instanceof Error
          ? err.message
          : isFa
            ? "ذخیره تغییرات با خطا مواجه شد"
            : "Failed to save site mode changes"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSelectDesignMode(designMode: DesignMode) {
    if (saving || modes.designMode === designMode) return;
    const def = SITE_DESIGN_MODES.find((m) => m.id === designMode);
    persistModes(
      { ...modes, designMode },
      `طراحی و رابط کاربری سایت به «${def?.nameFa ?? designMode}» تغییر کرد.`,
      `Site UI design switched to "${def?.nameEn ?? designMode}".`
    );
  }

  function handleSelectColorScheme(colorScheme: ColorScheme) {
    if (saving || modes.colorScheme === colorScheme) return;
    persistModes(
      { ...modes, colorScheme },
      colorScheme === "light"
        ? "حالت روشن (سفید) برای ظاهر سایت فعال شد."
        : "حالت تاریک (دارک) برای ظاهر سایت فعال شد.",
      colorScheme === "light"
        ? "Light (white) appearance enabled for the public site."
        : "Dark appearance enabled for the public site."
    );
  }

  function handleSelectTheme(themeId: SiteThemeId) {
    if (saving || modes.theme === themeId) return;
    const theme = SITE_THEMES.find((t) => t.id === themeId);
    persistModes(
      { ...modes, theme: themeId },
      `تم رنگی سایت به «${theme?.nameFa ?? themeId}» تغییر کرد.`,
      `Site color theme switched to "${theme?.nameEn ?? themeId}".`
    );
  }

  function handleSelectAmbient(ambientMode: AmbientMode) {
    if (saving || modes.ambientMode === ambientMode) return;
    persistModes(
      { ...modes, ambientMode },
      ambientMode === "calm"
        ? "حالت پس‌زمینه آرام و بدون حرکت فعال شد."
        : "حالت سینمایی جلوه‌های پس‌زمینه فعال شد.",
      ambientMode === "calm"
        ? "Calm ambient backdrop enabled."
        : "Cinematic ambient effects enabled."
    );
  }

  function handleSelectContrast(contrastMode: ContrastMode) {
    if (saving || modes.contrastMode === contrastMode) return;
    persistModes(
      { ...modes, contrastMode },
      contrastMode === "high"
        ? "حالت کنتراست بالا برای مطالعه فعال شد."
        : "کنتراست استاندارد بازگردانده شد.",
      contrastMode === "high"
        ? "High-contrast reading mode enabled."
        : "Standard contrast restored."
    );
  }

  function handleToggleApplyToAdmin() {
    if (saving) return;
    const nextVal = !modes.applyToAdmin;
    persistModes(
      { ...modes, applyToAdmin: nextVal },
      nextVal
        ? "تم انتخابی روی پنل مدیریت نیز اعمال می‌شود."
        : "پنل مدیریت روی تم پیش‌فرض باقی می‌ماند.",
      nextVal
        ? "Admin panel now mirrors the active site theme."
        : "Admin panel kept on the default Aurora theme."
    );
  }

  function handleResetDefaults() {
    if (saving) return;
    persistModes(
      { ...DEFAULT_SITE_MODES },
      "همه حالت‌های سایت به تنظیمات پیش‌فرض بازگردانده شدند.",
      "All site modes were reset to defaults."
    );
  }

  const isDefault =
    modes.designMode === DEFAULT_SITE_MODES.designMode &&
    modes.colorScheme === DEFAULT_SITE_MODES.colorScheme &&
    modes.theme === DEFAULT_SITE_MODES.theme &&
    modes.ambientMode === DEFAULT_SITE_MODES.ambientMode &&
    modes.contrastMode === DEFAULT_SITE_MODES.contrastMode &&
    modes.applyToAdmin === DEFAULT_SITE_MODES.applyToAdmin;

  const formattedTime = formatUpdatedAt(updatedAt, isFa);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-border-subtle) pb-6">
        <div className="max-w-2xl">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            {isFa ? "حالت‌های سایت" : "Site Modes"}
          </h1>
          <p className="mt-1.5 text-sm text-(--color-text-secondary)">
            {isFa
              ? "بین تم‌های رنگی، جلوه‌های محیطی و حالت‌های نمایشی کل سایت به‌صورت زنده جابه‌جا شوید. تغییرات بلافاصله برای همه بازدیدکنندگان ذخیره و اعمال می‌شوند."
              : "Switch color themes, ambient visual effects, and reading modes across the entire publication. Changes persist immediately for all visitors."}
          </p>
          {formattedTime && (
            <p className="mt-2 text-xs text-(--color-text-tertiary) tabular-nums">
              {isFa ? `آخرین ذخیره: ${formattedTime}` : `Last updated: ${formattedTime}`}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={saving || loading || isDefault}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-4 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isFa ? "بازگردانی پیش‌فرض" : "Reset defaults"}</span>
          </button>

          <Link
            href={`/${locale}`}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-4 text-xs font-medium text-white transition-opacity hover:opacity-95"
          >
            <span>{isFa ? "مشاهده سایت" : "Open live site"}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Live Save / Error Feedback */}
      {(saving || statusMessage || error) && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-(--color-accent-red)/40 bg-(--color-accent-red)/10 text-(--color-accent-red)"
              : "border-(--color-accent-purple)/40 bg-(--color-accent-purple)/10 text-(--color-text-primary)"
          }`}
        >
          {error ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : saving ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-(--color-accent-purple)" />
          ) : (
            <Check className="h-4 w-4 shrink-0 text-(--color-accent-purple)" />
          )}
          <span>
            {error
              ? error
              : saving
                ? isFa
                  ? "در حال ذخیره و اعمال حالت جدید سایت…"
                  : "Saving and applying site mode…"
                : statusMessage}
          </span>
        </div>
      )}

      {/* Section 0: Site Design & UI Style (Classic <-> Unslop Editorial <-> Unslop Kinetic) */}
      <section aria-labelledby="design-mode-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2
              id="design-mode-heading"
              className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)"
            >
              {isFa ? "سبک طراحی و رابط کاربری سایت" : "Site Design & UI Style"}
            </h2>
            <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
              {isFa
                ? "به‌صورت رفت‌وبرگشتی بین طراحی کلاسیک فضایی، طراحی Unslop رصدخانه‌ای و طراحی جدید Unslop زنده (آزمایشگاه نور و موج) جابه‌جا شوید."
                : "Switch freely between Classic Cosmic, Unslop Observatory Press, and the brand-new Unslop Kinetic living optical lab."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="h-80 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
            <div className="h-80 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
            <div className="h-80 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {SITE_DESIGN_MODES.map((def) => (
              <DesignModeOptionCard
                key={def.id}
                modeDef={def}
                active={modes.designMode === def.id}
                activeTheme={modes.theme}
                activeColorScheme={modes.colorScheme}
                isFa={isFa}
                disabled={saving}
                onSelect={() => handleSelectDesignMode(def.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 0.5: Light (White) vs Dark Color Scheme */}
      <section aria-labelledby="color-scheme-heading" className="space-y-4">
        <div>
          <h2
            id="color-scheme-heading"
            className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)"
          >
            {isFa ? "حالت روشن (سفید) و تاریک (دارک)" : "Light (White) & Dark Mode"}
          </h2>
          <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "بین پس‌زمینه سفید (روشن) و دارک (تاریک) برای کل ظاهر سایت سوئیچ کنید؛ روی هر سه طراحی سایت اعمال می‌شود."
              : "Switch the entire public site between light (white) and dark mode — works seamlessly across all three site designs."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SITE_COLOR_SCHEMES.map((scheme) => {
            const active = modes.colorScheme === scheme.id;
            const isLight = scheme.id === "light";
            const Icon = isLight ? Sun : Moon;
            const swatchBg = isLight
              ? modes.designMode === "unslop-kinetic"
                ? modes.theme === "emerald-blue"
                  ? "#E8F3F1"
                  : "#E8F2F8"
                : modes.designMode === "unslop"
                  ? modes.theme === "emerald-blue"
                    ? "#F2F6F4"
                    : "#F6F3EC"
                  : "#F8F9FC"
              : modes.designMode === "unslop-kinetic"
                ? modes.theme === "emerald-blue"
                  ? "#0B1414"
                  : "#0F1416"
                : modes.designMode === "unslop"
                  ? modes.theme === "emerald-blue"
                    ? "#0B1311"
                    : "#11100E"
                  : modes.theme === "emerald-blue"
                    ? "#040B12"
                    : "#05050A";
            const swatchCard = isLight
              ? "#FFFFFF"
              : modes.designMode === "unslop-kinetic"
                ? "#1B2428"
                : modes.designMode === "unslop"
                  ? "#201E1A"
                  : "#14141F";
            const swatchInk = isLight ? "#11161B" : "#EDF2F5";
            const swatchBorder = isLight ? "rgba(17, 22, 27, 0.16)" : "rgba(237, 242, 245, 0.16)";

            return (
              <button
                key={scheme.id}
                type="button"
                disabled={saving || loading}
                aria-pressed={active}
                data-color-scheme-option={scheme.id}
                onClick={() => handleSelectColorScheme(scheme.id)}
                className={`flex items-start gap-4 rounded-xl border p-4 text-start transition-colors ${
                  active
                    ? "border-(--color-accent-purple) bg-(--color-accent-purple)/10"
                    : "border-(--color-border-subtle) bg-(--color-bg-secondary) hover:border-(--color-border-strong)"
                }`}
              >
                {/* Live Surface Swatch Preview */}
                <div
                  aria-hidden="true"
                  className="flex h-14 w-16 shrink-0 flex-col justify-between rounded-lg border p-2"
                  style={{
                    backgroundColor: swatchBg,
                    borderColor: swatchBorder,
                    color: swatchInk,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span
                      className="h-1.5 w-5 rounded-sm"
                      style={{ backgroundColor: `${swatchInk}55` }}
                    />
                  </div>
                  <div
                    className="h-4 w-full rounded border"
                    style={{
                      backgroundColor: swatchCard,
                      borderColor: swatchBorder,
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-[family-name:var(--font-display)] text-sm font-bold text-(--color-text-primary)">
                      {isFa ? scheme.nameFa : scheme.nameEn}
                    </span>
                    {active && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-(--color-accent-purple)">
                        <Check className="h-3.5 w-3.5" />
                        <span>{isFa ? "فعال" : "Active"}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? scheme.taglineFa : scheme.taglineEn}
                  </p>
                  <p className="pt-0.5 text-xs leading-relaxed text-(--color-text-secondary)">
                    {isFa ? scheme.descriptionFa : scheme.descriptionEn}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 1: Color Themes */}
      <section aria-labelledby="color-themes-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2
              id="color-themes-heading"
              className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)"
            >
              {isFa ? "تم رنگی سایت" : "Color Theme"}
            </h2>
            <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
              {isFa
                ? "روی هر تم کلیک کنید تا رنگ‌بندی پس‌زمینه، کارت‌ها، دکمه‌ها و هاله‌های نوری کل سایت فوراً تغییر کند."
                : "Select a palette to switch backgrounds, surfaces, buttons, equations, and atmospheric glows site-wide."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-80 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
            <div className="h-80 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {SITE_THEMES.map((theme) => (
              <ThemeOptionCard
                key={theme.id}
                theme={theme}
                active={modes.theme === theme.id}
                isFa={isFa}
                disabled={saving}
                onSelect={() => handleSelectTheme(theme.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Additional Site Display Modes */}
      <section aria-labelledby="display-modes-heading" className="space-y-4">
        <div>
          <h2
            id="display-modes-heading"
            className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)"
          >
            {isFa ? "حالت‌های نمایش و تجربه مطالعه" : "Atmosphere & Reading Modes"}
          </h2>
          <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "سایر حالت‌های سراسری سایت برای کنترل انیمیشن پس‌زمینه، کنتراست متن و هماهنگی پنل مدیریت."
              : "Additional site-wide display modes controlling background motion, reading contrast, and admin synchronization."}
          </p>
        </div>

        <div className="divide-y divide-(--color-border-subtle) rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
          {/* Ambient Effects Mode */}
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "حالت جلوه‌های محیطی پس‌زمینه" : "Ambient Backdrop Mode"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-(--color-text-tertiary)">
                {isFa
                  ? "در حالت «سینمایی» ستاره‌ها، ذرات شناور و هاله‌های متحرک فعال هستند؛ در حالت «آرام» پس‌زمینه ثابت و کم‌مصرف می‌شود."
                  : "Cinematic displays animated orbs, drifting grids, and floating formulas. Calm keeps a still, distraction-free canvas."}
              </p>
            </div>
            <div
              role="group"
              aria-label={isFa ? "انتخاب حالت جلوه‌های محیطی" : "Ambient backdrop mode"}
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-1 sm:self-center"
            >
              <button
                type="button"
                disabled={saving || loading}
                aria-pressed={modes.ambientMode === "cinematic"}
                onClick={() => handleSelectAmbient("cinematic")}
                className={`whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-medium transition-colors ${
                  modes.ambientMode === "cinematic"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? "سینمایی" : "Cinematic"}
              </button>
              <button
                type="button"
                disabled={saving || loading}
                aria-pressed={modes.ambientMode === "calm"}
                onClick={() => handleSelectAmbient("calm")}
                className={`whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-medium transition-colors ${
                  modes.ambientMode === "calm"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? "آرام و ثابت" : "Calm"}
              </button>
            </div>
          </div>

          {/* Reading Contrast Mode */}
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "حالت کنتراست مطالعه" : "Reading Contrast Mode"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-(--color-text-tertiary)">
                {isFa
                  ? "کنتراست بالا روشنایی متن‌های ثانویه و وضوح خطوط جداکننده را برای مطالعه طولانی در هر دو تم افزایش می‌دهد."
                  : "High contrast strengthens secondary copy and surface hairlines across both themes for extended scientific reading."}
              </p>
            </div>
            <div
              role="group"
              aria-label={isFa ? "انتخاب حالت کنتراست" : "Reading contrast mode"}
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-1 sm:self-center"
            >
              <button
                type="button"
                disabled={saving || loading}
                aria-pressed={modes.contrastMode === "standard"}
                onClick={() => handleSelectContrast("standard")}
                className={`whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-medium transition-colors ${
                  modes.contrastMode === "standard"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? "استاندارد" : "Standard"}
              </button>
              <button
                type="button"
                disabled={saving || loading}
                aria-pressed={modes.contrastMode === "high"}
                onClick={() => handleSelectContrast("high")}
                className={`whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-medium transition-colors ${
                  modes.contrastMode === "high"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? "کنتراست بالا" : "High contrast"}
              </button>
            </div>
          </div>

          {/* Apply Theme to Admin Panel */}
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "هماهنگی تم پنل مدیریت" : "Apply Theme to Admin Panel"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-(--color-text-tertiary)">
                {isFa
                  ? "در صورت فعال بودن، رنگ‌بندی انتخابی شما علاوه بر سایت عمومی، روی محیط پنل مدیریت نیز اعمال می‌شود."
                  : "When enabled, the selected color theme applies to this admin console as well as the public site."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={modes.applyToAdmin}
              disabled={saving || loading}
              onClick={handleToggleApplyToAdmin}
              className={`inline-flex h-10 shrink-0 items-center gap-2.5 self-start whitespace-nowrap rounded-lg border px-4 text-xs font-medium transition-colors sm:self-center ${
                modes.applyToAdmin
                  ? "border-(--color-accent-purple) bg-(--color-accent-purple)/15 text-(--color-text-primary)"
                  : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong)"
              }`}
            >
              <span
                aria-hidden="true"
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  modes.applyToAdmin ? "bg-(--color-accent-purple)" : "bg-white/15"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    modes.applyToAdmin
                      ? isFa
                        ? "-translate-x-4.5"
                        : "translate-x-4.5"
                      : isFa
                        ? "-translate-x-1"
                        : "translate-x-1"
                  }`}
                />
              </span>
              <span>
                {modes.applyToAdmin
                  ? isFa
                    ? "فعال"
                    : "Enabled"
                  : isFa
                    ? "خاموش"
                    : "Disabled"}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DesignModeOptionCard({
  modeDef,
  active,
  activeTheme,
  activeColorScheme,
  isFa,
  disabled,
  onSelect,
}: {
  modeDef: SiteDesignModeDefinition;
  active: boolean;
  activeTheme: SiteThemeId;
  activeColorScheme: ColorScheme;
  isFa: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const isUnslop = modeDef.id === "unslop";
  const isKinetic = modeDef.id === "unslop-kinetic";
  const isDark = activeColorScheme === "dark";
  const activeThemeDef =
    SITE_THEMES.find((t) => t.id === activeTheme) ?? SITE_THEMES[0];
  const basePreview = activeThemeDef.preview;

  // Classic mini-preview adapts cleanly between Dark Cosmic and Light Daylight
  const p = isDark
    ? basePreview
    : activeTheme === "emerald-blue"
      ? {
          ...basePreview,
          bgDeep: "#f3f8f7",
          bgSecondary: "#e6f0ee",
          bgElevated: "#ffffff",
          accentPrimary: "#0d7a59",
          accentSecondary: "#1269b0",
          gradientStart: "#0c7555",
          gradientMid: "#1269b0",
          gradientEnd: "#0e6b6e",
          textPrimary: "#0b1c1a",
          textSecondary: "#395350",
          borderSubtle: "rgba(11, 28, 26, 0.14)",
        }
      : {
          ...basePreview,
          bgDeep: "#f8f9fc",
          bgSecondary: "#eef1f7",
          bgElevated: "#ffffff",
          accentPrimary: "#6428e8",
          accentSecondary: "#dc5b00",
          gradientStart: "#5b21d6",
          gradientMid: "#dc5b00",
          gradientEnd: "#d4264e",
          textPrimary: "#101323",
          textSecondary: "#434a66",
          borderSubtle: "rgba(16, 19, 35, 0.14)",
        };

  // Unslop Observatory mini-preview adapts between Light Archival Paper and Dark Slate
  const paperBg = isDark
    ? activeTheme === "emerald-blue"
      ? "#0B1311"
      : "#11100E"
    : activeTheme === "emerald-blue"
      ? "#F2F6F4"
      : "#F6F3EC";
  const paperCard = isDark
    ? activeTheme === "emerald-blue"
      ? "#172723"
      : "#201E1A"
    : activeTheme === "emerald-blue"
      ? "#FCFDFC"
      : "#FFFDF9";
  const paperInk = isDark
    ? activeTheme === "emerald-blue"
      ? "#EAF3F0"
      : "#EFEAE0"
    : activeTheme === "emerald-blue"
      ? "#111C19"
      : "#181613";
  const paperMuted = isDark
    ? activeTheme === "emerald-blue"
      ? "#9FB7B0"
      : "#B5AEA2"
    : activeTheme === "emerald-blue"
      ? "#455952"
      : "#565149";
  const paperBorder = isDark
    ? "rgba(239, 234, 224, 0.16)"
    : activeTheme === "emerald-blue"
      ? "rgba(17, 28, 25, 0.14)"
      : "rgba(24, 22, 19, 0.14)";
  const paperAccent = isDark
    ? activeTheme === "emerald-blue"
      ? "#3CC69D"
      : "#6B9BF2"
    : activeTheme === "emerald-blue"
      ? "#0F5E48"
      : "#1E458F";

  // Unslop Kinetic mini-preview adapts between Light Optical Bench (#E8F2F8) and Dark Optical Slate (#0F1416)
  const kineticBg = isDark
    ? activeTheme === "emerald-blue"
      ? "#0B1414"
      : "#0F1416"
    : activeTheme === "emerald-blue"
      ? "#E8F3F1"
      : "#E8F2F8";
  const kineticCard = isDark
    ? activeTheme === "emerald-blue"
      ? "#172929"
      : "#1B2428"
    : "#FFFFFF";
  const kineticInk = isDark ? "#EDF2F5" : "#11161B";
  const kineticMuted = isDark ? "#A8B6BF" : "#3F4D59";
  const kineticBorder = isDark ? "rgba(237, 242, 245, 0.16)" : "rgba(17, 22, 27, 0.14)";
  const kineticAccent = isDark
    ? activeTheme === "emerald-blue"
      ? "#38C7AA"
      : "#F07249"
    : activeTheme === "emerald-blue"
      ? "#0D7A67"
      : "#C84B24";

  const highlights = isFa ? modeDef.highlightsFa : modeDef.highlightsEn;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border transition-colors ${
        active
          ? "border-(--color-accent-purple) bg-(--color-bg-secondary)"
          : "border-(--color-border-subtle) bg-(--color-bg-secondary) hover:border-(--color-border-strong)"
      }`}
    >
      {/* Live Architectural Mini-Preview */}
      {isKinetic ? (
        <div
          className="relative overflow-hidden border-b p-5"
          style={{
            backgroundColor: kineticBg,
            borderColor: kineticBorder,
            color: kineticInk,
          }}
        >
          {/* Mini Optical Lab Masthead */}
          <div
            className="flex items-center justify-between border-b pb-2.5"
            style={{ borderColor: kineticBorder }}
          >
            <div className="flex items-center gap-1.5">
              <Aperture
                className="h-3.5 w-3.5"
                strokeWidth={1.6}
                style={{ color: kineticInk }}
              />
              <span
                className="text-xs font-semibold tracking-tight"
                style={{ color: kineticInk }}
              >
                Scienta
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-7 rounded-sm"
                style={{ backgroundColor: kineticAccent }}
              />
              <span
                className="h-1.5 w-6 rounded-sm"
                style={{ backgroundColor: `${kineticInk}30` }}
              />
              <span
                className="h-1.5 w-5 rounded-sm"
                style={{ backgroundColor: `${kineticInk}30` }}
              />
            </div>
          </div>

          {/* Mini Prism Studio Hero */}
          <div className="relative mt-3.5 grid grid-cols-12 items-start gap-3">
            <div className="relative z-10 col-span-7 space-y-2">
              <p
                className="text-[10px] font-medium"
                style={{ color: kineticAccent }}
              >
                {isFa ? "آزمایشگاه زنده نور و موج" : "Living Optical Bench"}
              </p>
              <p
                className="text-base font-semibold leading-snug"
                style={{ color: kineticInk }}
              >
                {isFa
                  ? "فیزیک را زنده تجربه و لمس کنید"
                  : "Interact with living physics"}
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: kineticMuted }}
              >
                {isFa
                  ? "منشور واقعی، شبیه‌ساز ۶۰ فریم و کاوشگر زنده مقالات."
                  : "Real crystal prism, 60fps simulator & live essay deck."}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span
                  className="inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: kineticInk,
                    color: kineticBg,
                  }}
                >
                  {isFa ? "آزمایشگاه زنده" : "Open bench"}
                </span>
                <span
                  className="inline-flex h-6 items-center rounded-md border px-2.5 text-[10px] font-medium"
                  style={{
                    borderColor: kineticBorder,
                    backgroundColor: kineticCard,
                    color: kineticInk,
                  }}
                >
                  {isFa ? "مقالات" : "Essays"}
                </span>
              </div>
            </div>

            {/* Real Studio Optical Prism Photo */}
            <div className="col-span-5 flex flex-col justify-between gap-2">
              <div className="relative h-24 w-full overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={isDark ? "/images/unslop-prism-dark.webp" : "/images/unslop-prism-light.webp"}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover object-right"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse 82% 88% at 62% 50%, #000 58%, transparent 100%)",
                    maskImage:
                      "radial-gradient(ellipse 82% 88% at 62% 50%, #000 58%, transparent 100%)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Mini Live Simulator Readout Strip */}
          <div
            className="mt-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            style={{
              backgroundColor: kineticCard,
              borderColor: kineticBorder,
            }}
            dir="ltr"
          >
            <span
              className="font-[family-name:var(--font-mono)] text-[10px] font-medium"
              style={{ color: kineticInk }}
            >
              λ = 540 nm · Δy = 4.5 mm
            </span>
            <span
              className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums"
              style={{ color: kineticAccent }}
            >
              60fps · Live Bench
            </span>
          </div>
        </div>
      ) : isUnslop ? (
        <div
          className="relative overflow-hidden border-b p-5"
          style={{
            backgroundColor: paperBg,
            borderColor: paperBorder,
            color: paperInk,
          }}
        >
          {/* Mini Archival Masthead */}
          <div
            className="flex items-center justify-between border-b pb-2.5"
            style={{ borderColor: paperBorder }}
          >
            <div className="flex items-center gap-1.5">
              <Compass
                className="h-3.5 w-3.5"
                strokeWidth={1.6}
                style={{ color: paperInk }}
              />
              <span
                className="text-xs font-semibold tracking-tight"
                style={{ color: paperInk }}
              >
                Scienta
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="h-1.5 w-7 rounded-sm"
                style={{ backgroundColor: paperInk }}
              />
              <span
                className="h-1.5 w-7 rounded-sm"
                style={{ backgroundColor: `${paperInk}30` }}
              />
              <span
                className="h-1.5 w-5 rounded-sm"
                style={{ backgroundColor: `${paperInk}30` }}
              />
            </div>
          </div>

          {/* Mini Broadsheet Hero with Genuine Observatory Engraving */}
          <div className="relative mt-3.5 grid grid-cols-12 items-start gap-3">
            <div className="relative z-10 col-span-7 space-y-2">
              <p
                className="text-[10px] font-medium"
                style={{ color: paperAccent }}
              >
                {isFa ? "نشریه علمی · رصدخانه" : "Scientific Journal"}
              </p>
              <p
                className="text-base font-semibold leading-snug"
                style={{ color: paperInk }}
              >
                {isFa
                  ? "جهان را بخوانید، هر بار یک اثبات"
                  : "Read the universe, one proof at a time"}
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: paperMuted }}
              >
                {isDark
                  ? isFa
                    ? "اطلس رصدخانه‌ای شب با جوهر روشن و گراور نقره‌ای‌طلایی."
                    : "Nocturnal observatory slate with bone-white ink and etched plate."
                  : isFa
                    ? "کاغذ آرشیوی گرم، گراور اختصاصی و خوانایی آرام بدون افکت اضافه."
                    : "Warm archival paper, engraved plate, and calm monograph cadence."}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span
                  className="inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: paperInk,
                    color: paperBg,
                  }}
                >
                  {isFa ? "کاوش مقالات" : "Read archive"}
                </span>
                <span
                  className="inline-flex h-6 items-center rounded-md border px-2.5 text-[10px] font-medium"
                  style={{
                    borderColor: paperBorder,
                    backgroundColor: paperCard,
                    color: paperInk,
                  }}
                >
                  {isFa ? "رشته‌ها" : "Fields"}
                </span>
              </div>
            </div>

            {/* Engraved Observatory Plate */}
            <div className="col-span-5 flex flex-col justify-between gap-2">
              <div className="relative h-24 w-full overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/unslop-observatory-hero.webp"
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover object-right"
                  style={{
                    filter: isDark
                      ? "brightness(1.09) contrast(1.08) invert(1) hue-rotate(180deg) brightness(0.92)"
                      : "brightness(1.09) contrast(1.08)",
                    mixBlendMode: isDark ? "screen" : "multiply",
                    WebkitMaskImage:
                      "radial-gradient(ellipse 70% 80% at 62% 50%, #000 52%, transparent 98%)",
                    maskImage:
                      "radial-gradient(ellipse 70% 80% at 62% 50%, #000 52%, transparent 98%)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Rising Proof Sheet Preview */}
          <div
            className="mt-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            style={{
              backgroundColor: paperCard,
              borderColor: paperBorder,
              boxShadow: isDark
                ? "0 1px 2px rgba(0, 0, 0, 0.28)"
                : "0 1px 2px rgba(24, 22, 19, 0.05)",
            }}
            dir="ltr"
          >
            <span
              className="font-[family-name:var(--font-mono)] text-[10px] font-medium"
              style={{ color: paperInk }}
            >
              rₛ = 2GM / c²
            </span>
            <span
              className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums"
              style={{ color: paperAccent }}
            >
              2.95 km · Proof Sheet
            </span>
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden border-b p-5"
          style={{
            backgroundColor: p.bgDeep,
            borderColor: p.borderSubtle,
            backgroundImage: `radial-gradient(55% 75% at 15% 12%, ${p.accentPrimary}38, transparent 62%), radial-gradient(50% 65% at 88% 18%, ${p.accentSecondary}2e, transparent 62%), radial-gradient(60% 70% at 50% 100%, ${p.auroraThird}28, transparent 64%)`,
          }}
        >
          {/* Mini Cosmic Navbar */}
          <div
            className="flex items-center justify-between rounded-lg border px-3 py-2"
            style={{
              backgroundColor: `${p.bgSecondary}cc`,
              borderColor: p.borderSubtle,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${p.accentPrimary}, ${p.auroraThird})`,
                }}
              >
                <Sparkles className="h-3 w-3 text-white" />
              </span>
              <span
                className="text-xs font-bold"
                style={{
                  backgroundImage: `linear-gradient(110deg, ${p.gradientStart}, ${p.gradientMid}, ${p.gradientEnd})`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                Scienta
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="h-1.5 w-8 rounded-full"
                style={{ backgroundColor: `${p.textSecondary}55` }}
              />
              <span
                className="h-1.5 w-8 rounded-full"
                style={{ backgroundColor: `${p.textSecondary}35` }}
              />
              <span
                className="h-1.5 w-6 rounded-full"
                style={{ backgroundColor: `${p.textSecondary}35` }}
              />
            </div>
          </div>

          {/* Mini Cosmic Hero */}
          <div className="mt-4 grid grid-cols-12 items-center gap-3">
            <div className="col-span-7 space-y-2">
              <p
                className="font-[family-name:var(--font-display)] text-base font-extrabold leading-snug"
                style={{
                  backgroundImage: `linear-gradient(110deg, ${p.gradientStart} 0%, ${p.gradientMid} 55%, ${p.gradientEnd} 100%)`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                {isFa
                  ? "جهان را بخوانید، هر بار یک اثبات"
                  : "Read the universe, one proof at a time"}
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: p.textSecondary }}
              >
                {isDark
                  ? isFa
                    ? "فضای کیهانی تاریک با گرادیان شفق و کنسول زنده اثبات."
                    : "Deep cosmic dark UI with aurora gradients and live console."
                  : isFa
                    ? "نسخه روشن و سفید کلاسیک با شفق ملایم و کنسول زنده."
                    : "Luminous white Classic UI with airy aurora wash and live console."}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span
                  className="inline-flex h-6 items-center rounded-full px-3 text-[10px] font-medium text-white"
                  style={{
                    background: `linear-gradient(90deg, ${p.accentPrimary}, ${p.accentSecondary})`,
                  }}
                >
                  {isFa ? "کاوش مقالات" : "Explore"}
                </span>
                <span
                  className="inline-flex h-6 items-center rounded-full border px-2.5 text-[10px]"
                  style={{
                    borderColor: p.borderSubtle,
                    color: p.textPrimary,
                    backgroundColor: `${p.bgElevated}99`,
                  }}
                >
                  {isFa ? "درباره" : "About"}
                </span>
              </div>
            </div>

            <div
              className="col-span-5 rounded-lg border p-3"
              style={{
                backgroundColor: `${p.bgElevated}d9`,
                borderColor: p.borderSubtle,
              }}
              dir="ltr"
            >
              <div className="mb-2 flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: p.auroraThird }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: p.accentSecondary }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: p.accentPrimary }}
                />
              </div>
              <div
                className="rounded border px-2 py-2 text-center font-[family-name:var(--font-mono)] text-[11px]"
                style={{
                  borderColor: `${p.accentPrimary}55`,
                  backgroundColor: `${p.accentPrimary}18`,
                  color: p.textPrimary,
                }}
              >
                rₛ = 2GM / c²
              </div>
              <div
                className="mt-2 flex items-center justify-between text-[9px]"
                style={{ color: p.textSecondary }}
              >
                <span>Terminal</span>
                <span style={{ color: p.accentSecondary }}>Live</span>
              </div>
            </div>
          </div>

          <div className="mt-3 h-7" aria-hidden="true" />
        </div>
      )}

      {/* Design Mode Details, Highlights & Round-Trip Switch CTA */}
      <div className="flex flex-1 flex-col justify-between gap-5 p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-(--color-text-primary)">
                {isFa ? modeDef.nameFa : modeDef.nameEn}
              </h3>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                {isFa ? modeDef.taglineFa : modeDef.taglineEn}
              </p>
            </div>
            {active && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-(--color-accent-purple)">
                <Check className="h-3.5 w-3.5" />
                <span>{isFa ? "طراحی فعال" : "Active UI"}</span>
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed text-(--color-text-secondary)">
            {isFa ? modeDef.descriptionFa : modeDef.descriptionEn}
          </p>

          <ul className="space-y-1.5 border-t border-(--color-border-subtle) pt-3">
            {highlights.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-xs text-(--color-text-secondary)"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-(--color-accent-purple)" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          disabled={disabled || active}
          onClick={onSelect}
          aria-pressed={active}
          data-design-mode-option={modeDef.id}
          className={`flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-colors ${
            active
              ? "cursor-default border border-(--color-accent-purple)/40 bg-(--color-accent-purple)/15 text-(--color-text-primary)"
              : "border border-(--color-border-strong) bg-(--color-bg-elevated) text-(--color-text-primary) hover:border-(--color-accent-purple) hover:bg-(--color-accent-purple)/15"
          }`}
        >
          {active ? (
            <>
              <Check className="h-3.5 w-3.5 text-(--color-accent-purple)" />
              <span>{isFa ? "هم‌اکنون فعال است" : "Currently active"}</span>
            </>
          ) : (
            <span>
              {isFa
                ? `سوئیچ به «${modeDef.nameFa}»`
                : `Switch to ${modeDef.nameEn}`}
            </span>
          )}
        </button>
      </div>
    </article>
  );
}

function ThemeOptionCard({
  theme,
  active,
  isFa,
  disabled,
  onSelect,
}: {
  theme: SiteThemeDefinition;
  active: boolean;
  isFa: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const p = theme.preview;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border transition-colors ${
        active
          ? "border-(--color-accent-purple) bg-(--color-bg-secondary)"
          : "border-(--color-border-subtle) bg-(--color-bg-secondary) hover:border-(--color-border-strong)"
      }`}
    >
      {/* Visual Live Theme Preview */}
      <div
        className="relative overflow-hidden border-b p-5"
        style={{
          backgroundColor: p.bgDeep,
          borderColor: p.borderSubtle,
          backgroundImage: `radial-gradient(55% 75% at 15% 12%, ${p.accentPrimary}38, transparent 62%), radial-gradient(50% 65% at 88% 18%, ${p.accentSecondary}2e, transparent 62%), radial-gradient(60% 70% at 50% 100%, ${p.auroraThird}28, transparent 64%)`,
        }}
      >
        {/* Mini Navbar */}
        <div
          className="flex items-center justify-between rounded-lg border px-3 py-2"
          style={{
            backgroundColor: `${p.bgSecondary}cc`,
            borderColor: p.borderSubtle,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md"
              style={{
                background: `linear-gradient(135deg, ${p.accentPrimary}, ${p.auroraThird})`,
              }}
            >
              <Sparkles className="h-3 w-3 text-white" />
            </span>
            <span
              className="text-xs font-bold"
              style={{
                background: `linear-gradient(110deg, ${p.gradientStart}, ${p.gradientMid}, ${p.gradientEnd})`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Scienta
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: `${p.textSecondary}55` }} />
            <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: `${p.textSecondary}35` }} />
            <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: `${p.textSecondary}35` }} />
          </div>
        </div>

        {/* Mini Hero Split */}
        <div className="mt-4 grid grid-cols-12 items-center gap-3">
          <div className="col-span-7 space-y-2.5">
            <p
              className="font-[family-name:var(--font-display)] text-base font-extrabold leading-snug"
              style={{
                background: `linear-gradient(110deg, ${p.gradientStart} 0%, ${p.gradientMid} 55%, ${p.gradientEnd} 100%)`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              {isFa ? "جهان را بخوانید، هر بار یک اثبات" : "Read the universe, one proof at a time"}
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: p.textSecondary }}>
              {isFa
                ? "روایت‌های عمیق علمی از فیزیک، فضا و ریاضیات."
                : "Deep scientific essays across physics, space, and math."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span
                className="inline-flex h-6 items-center rounded-full px-3 text-[10px] font-medium text-white"
                style={{
                  background: `linear-gradient(90deg, ${p.accentPrimary}, ${p.accentSecondary})`,
                }}
              >
                {isFa ? "کاوش مقالات" : "Explore"}
              </span>
              <span
                className="inline-flex h-6 items-center rounded-full border px-2.5 text-[10px]"
                style={{
                  borderColor: p.borderSubtle,
                  color: p.textPrimary,
                  backgroundColor: `${p.bgElevated}99`,
                }}
              >
                {isFa ? "درباره" : "About"}
              </span>
            </div>
          </div>

          {/* Mini Equation Console */}
          <div
            className="col-span-5 rounded-lg border p-3"
            style={{
              backgroundColor: `${p.bgElevated}d9`,
              borderColor: p.borderSubtle,
            }}
            dir="ltr"
          >
            <div className="mb-2 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.auroraThird }} />
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.accentSecondary }} />
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.accentPrimary }} />
            </div>
            <div
              className="rounded border px-2 py-2 text-center font-[family-name:var(--font-mono)] text-[11px]"
              style={{
                borderColor: `${p.accentPrimary}55`,
                backgroundColor: `${p.accentPrimary}18`,
                color: p.textPrimary,
              }}
            >
              rₛ = 2GM / c²
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: p.textSecondary }}>
              <span>Schwarzschild</span>
              <span style={{ color: p.accentSecondary }}>2.95 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Metadata, Swatches & Action */}
      <div className="flex flex-1 flex-col justify-between gap-5 p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-(--color-text-primary)">
                {isFa ? theme.nameFa : theme.nameEn}
              </h3>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                {isFa ? theme.taglineFa : theme.taglineEn}
              </p>
            </div>
            {active && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-(--color-accent-purple)">
                <Check className="h-3.5 w-3.5" />
                <span>{isFa ? "تم فعال" : "Active"}</span>
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-(--color-text-secondary)">
            {isFa ? theme.descriptionFa : theme.descriptionEn}
          </p>
        </div>

        {/* Palette Swatches */}
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {theme.swatches.map((swatch) => (
              <div key={swatch.hex} className="space-y-1">
                <div
                  className="h-7 w-full rounded-md border border-white/15"
                  style={{ backgroundColor: swatch.hex }}
                  title={`${isFa ? swatch.labelFa : swatch.labelEn}: ${swatch.hex}`}
                />
                <p className="truncate text-[10px] text-(--color-text-secondary)">
                  {isFa ? swatch.labelFa : swatch.labelEn}
                </p>
                <p
                  className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-(--color-text-tertiary)"
                  dir="ltr"
                >
                  {swatch.hex}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={disabled || active}
            onClick={onSelect}
            aria-pressed={active}
            className={`flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-colors ${
              active
                ? "cursor-default border border-(--color-accent-purple)/40 bg-(--color-accent-purple)/15 text-(--color-text-primary)"
                : "bg-(--color-bg-elevated) text-(--color-text-primary) border border-(--color-border-strong) hover:border-(--color-accent-purple) hover:bg-(--color-accent-purple)/15"
            }`}
          >
            {active ? (
              <>
                <Check className="h-3.5 w-3.5 text-(--color-accent-purple)" />
                <span>{isFa ? "هم‌اکنون فعال است" : "Currently active"}</span>
              </>
            ) : (
              <span>
                {isFa
                  ? `فعال‌سازی تم «${theme.nameFa}»`
                  : `Switch to ${theme.nameEn}`}
              </span>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
