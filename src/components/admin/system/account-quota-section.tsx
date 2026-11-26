"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Cpu,
  Files,
  FolderOpen,
  HardDrive,
  Layers,
  Loader2,
  MemoryStick,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { formatBytesCompact, getUsageSeverity } from "@/lib/system-updater-core";
import {
  formatCountCompact,
  formatQuotaSourceLabel,
  type AccountQuotaConfig,
  type AccountQuotaSnapshot,
} from "@/lib/account-quota-core";
import { ResourceGauge } from "./resource-gauge";

interface AccountQuotaSectionProps {
  quota: AccountQuotaSnapshot | null | undefined;
  diskHistory: number[];
  ramHistory: number[];
  cpuHistory: number[];
  inodeHistory: number[];
  isFa: boolean;
  onQuotaSaved: () => Promise<void> | void;
}

const DISK_PRESETS_MB = [
  { label: "500 MB", mb: 500 },
  { label: "1 GB", mb: 1024 },
  { label: "2 GB", mb: 2048 },
  { label: "5 GB", mb: 5120 },
] as const;

function getBarColorClass(percent: number, defaultClass: string): string {
  const sev = getUsageSeverity(percent);
  if (sev === "critical") return "bg-red-500";
  if (sev === "elevated") return "bg-amber-400";
  return defaultClass;
}

export function AccountQuotaSection({
  quota,
  diskHistory,
  ramHistory,
  cpuHistory,
  inodeHistory,
  isFa,
  onQuotaSaved,
}: AccountQuotaSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [planLabel, setPlanLabel] = useState("");
  const [diskLimitMb, setDiskLimitMb] = useState("");
  const [ramLimitMb, setRamLimitMb] = useState("");
  const [cpuCores, setCpuCores] = useState("");
  const [inodeLimit, setInodeLimit] = useState("");
  const [entryProcessLimit, setEntryProcessLimit] = useState("");

  function openEditor() {
    if (quota) {
      setPlanLabel(quota.config.planLabel || "");
      setDiskLimitMb(quota.config.diskLimitMb !== null ? String(quota.config.diskLimitMb) : "");
      setRamLimitMb(quota.config.ramLimitMb !== null ? String(quota.config.ramLimitMb) : "");
      setCpuCores(quota.config.cpuCores !== null ? String(quota.config.cpuCores) : "");
      setInodeLimit(quota.config.inodeLimit !== null ? String(quota.config.inodeLimit) : "");
      setEntryProcessLimit(
        quota.config.entryProcessLimit !== null ? String(quota.config.entryProcessLimit) : ""
      );
    }
    setFeedback(null);
    setEditorOpen(true);
  }

  async function submitQuota(payload: {
    planLabel: string;
    diskLimitMb: string | null;
    ramLimitMb: string | null;
    cpuCores: string | null;
    inodeLimit: string | null;
    entryProcessLimit: string | null;
  }) {
    setSaving(true);
    setFeedback(null);
    try {
      await adminFetch<{ config: AccountQuotaConfig }>("/api/admin/system/quota", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await onQuotaSaved();
      setFeedback({
        type: "success",
        text: isFa
          ? "سقف منابع اکانت شما ذخیره شد و عقربه‌ها با سهمیه جدید بروزرسانی شدند."
          : "Account resource limits saved. Gauges updated to your allocated quota.",
      });
      setEditorOpen(false);
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : isFa
              ? "خطا در ذخیره سقف منابع"
              : "Failed to save account quota limits",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await submitQuota({
      planLabel,
      diskLimitMb: diskLimitMb.trim() || null,
      ramLimitMb: ramLimitMb.trim() || null,
      cpuCores: cpuCores.trim() || null,
      inodeLimit: inodeLimit.trim() || null,
      entryProcessLimit: entryProcessLimit.trim() || null,
    });
  }

  async function handleResetAuto() {
    setPlanLabel("");
    setDiskLimitMb("");
    setRamLimitMb("");
    setCpuCores("");
    setInodeLimit("");
    setEntryProcessLimit("");
    await submitQuota({
      planLabel: "",
      diskLimitMb: null,
      ramLimitMb: null,
      cpuCores: null,
      inodeLimit: null,
      entryProcessLimit: null,
    });
  }

  async function handleQuickApplyDiskCap(mb: number, label: string) {
    await submitQuota({
      planLabel: quota?.config.planLabel || (isFa ? `پلن هاست ${label}` : `${label} Hosting Plan`),
      diskLimitMb: String(mb),
      ramLimitMb: quota?.config.ramLimitMb !== null && quota?.config.ramLimitMb !== undefined ? String(quota.config.ramLimitMb) : null,
      cpuCores: quota?.config.cpuCores !== null && quota?.config.cpuCores !== undefined ? String(quota.config.cpuCores) : null,
      inodeLimit: quota?.config.inodeLimit !== null && quota?.config.inodeLimit !== undefined ? String(quota.config.inodeLimit) : null,
      entryProcessLimit:
        quota?.config.entryProcessLimit !== null && quota?.config.entryProcessLimit !== undefined
          ? String(quota.config.entryProcessLimit)
          : null,
    });
  }

  const loading = !quota;
  const hasAnyManualCap = Boolean(
    quota &&
      (quota.config.diskLimitMb !== null ||
        quota.config.ramLimitMb !== null ||
        quota.config.cpuCores !== null ||
        quota.config.inodeLimit !== null ||
        quota.config.entryProcessLimit !== null)
  );

  const detectionSummary = (() => {
    if (!quota) return isFa ? "در حال شناسایی سهمیه اکانت…" : "Detecting account quota…";
    if (quota.config.planLabel) return quota.config.planLabel;
    const parts: string[] = [];
    if (quota.detectedCapabilities.linuxDiskQuota) {
      parts.push(isFa ? "سهمیه دیسک لینوکس فعال" : "Linux Disk Quota");
    }
    if (quota.detectedCapabilities.cgroupVersion !== "none") {
      parts.push(`cgroup ${quota.detectedCapabilities.cgroupVersion}`);
    }
    if (hasAnyManualCap) {
      parts.push(isFa ? "سقف پلن سفارشی" : "Custom Plan Limits");
    }
    if (parts.length === 0) {
      return isFa
        ? "سهمیه اختصاصی قابل تنظیم برای هاست اشتراکی (مثلاً ۵۰۰ مگابایت دیسک)"
        : "Configurable shared-hosting allocation (e.g. 500 MB disk cap)";
    }
    return parts.join(" · ");
  })();

  return (
    <section
      data-testid="account-quota-section"
      aria-label={isFa ? "منابع در دسترس اکانت من" : "My allocated account resources"}
      className="space-y-4 pt-2"
    >
      {/* Clean Section Divider & Header */}
      <div className="flex flex-col gap-3 border-t border-(--color-border-subtle) pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-(--color-text-primary)">
              {isFa ? "منابع در دسترس اکانت من (سهمیه هاست)" : "My Account Resources (Host Quota)"}
            </h2>
            <span className="text-xs text-(--color-text-tertiary)">·</span>
            <span className="text-xs font-medium text-(--color-accent-cyan)">
              {detectionSummary}
            </span>
          </div>
          <p className="mt-1 text-xs text-(--color-text-secondary)">
            {isFa
              ? "مصرف دقیق و مقدار باقی‌مانده از سهمیه اختصاصی اکانت شما روی هاست اشتراکی (مجزا از آمار کل سرور بالا)."
              : "Exact usage and remaining capacity of your allocated hosting account quota, isolated from the whole-server figures above."}
          </p>
        </div>

        <button
          type="button"
          data-testid="toggle-quota-editor"
          onClick={() => (editorOpen ? setEditorOpen(false) : openEditor())}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap sm:self-auto"
        >
          {editorOpen ? (
            <>
              <X className="h-3.5 w-3.5" />
              <span>{isFa ? "بستن تنظیمات" : "Close Limits"}</span>
            </>
          ) : (
            <>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{isFa ? "تنظیم سقف پلن من" : "Configure Plan Limits"}</span>
            </>
          )}
        </button>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
            aria-label={isFa ? "بستن پیام" : "Dismiss notice"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Honest Fallback Prompt when Shared Host Hides Disk Plan Cap */}
      {quota && quota.disk.source === "host_fallback" && !editorOpen && (
        <div
          data-testid="quota-fallback-prompt"
          className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-4"
        >
          <div className="flex items-start gap-2.5 text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="leading-relaxed">
              {isFa
                ? `هاست اشتراکی شما سقف فضای پلن را به‌صورت خودکار اعلام نمی‌کند (مصرف فعلی اکانت شما ${formatBytesCompact(quota.disk.used)} است). حجم پلن هاست خود را انتخاب کنید تا باقی‌مانده دقیق محاسبه شود:`
                : `Your shared host hides the billing disk cap from Node.js (current account usage: ${formatBytesCompact(quota.disk.used)}). Pick your plan size to calculate exact remaining space:`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {DISK_PRESETS_MB.map((preset) => (
              <button
                key={preset.mb}
                type="button"
                disabled={saving}
                onClick={() => void handleQuickApplyDiskCap(preset.mb, preset.label)}
                className="rounded-md border border-amber-400/35 bg-(--color-bg-deep)/80 px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-amber-100 transition-colors hover:border-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={openEditor}
              className="rounded-md bg-amber-500/25 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/35"
            >
              {isFa ? "مقدار دلخواه" : "Custom"}
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Hosting Plan Limit Editor */}
      <AnimatePresence initial={false}>
        {editorOpen && (
          <motion.form
            key="quota-editor"
            onSubmit={handleSave}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-(--color-border-strong) bg-(--color-bg-secondary)"
          >
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-(--color-text-primary)">
                    {isFa
                      ? "تنظیم سقف سهمیه پلن هاست اشتراکی"
                      : "Set Your Hosting Plan Resource Limits"}
                  </h3>
                  <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                    {isFa
                      ? "اگر هاست شما محدودیت را به‌صورت خودکار اعلام نمی‌کند، اعداد پلن خود را وارد کنید؛ فیلدهای خالی به‌صورت خودکار تشخیص داده می‌شوند."
                      : "Enter your exact hosting plan caps if the host hides Linux/LVE quotas. Leave any field blank for automatic OS/cgroup detection."}
                  </p>
                </div>

                {/* Quick Disk Cap Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-(--color-text-tertiary)">
                    {isFa ? "پیش‌تنظیم دیسک:" : "Disk presets:"}
                  </span>
                  {DISK_PRESETS_MB.map((preset) => (
                    <button
                      key={preset.mb}
                      type="button"
                      onClick={() => setDiskLimitMb(String(preset.mb))}
                      className={`rounded-md border px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums transition-colors ${
                        diskLimitMb === String(preset.mb)
                          ? "border-(--color-accent-purple) bg-(--color-accent-purple)/20 text-(--color-text-primary)"
                          : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong)"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    {isFa ? "سقف فضای دیسک (مگابایت / MB)" : "Disk Space Limit (MB)"}
                  </span>
                  <input
                    type="number"
                    min={16}
                    max={10485760}
                    step="1"
                    dir="ltr"
                    name="diskLimitMb"
                    value={diskLimitMb}
                    onChange={(e) => setDiskLimitMb(e.target.value)}
                    placeholder={isFa ? "مثلاً 500 (خالی = خودکار)" : "e.g. 500 (blank = auto)"}
                    className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    {isFa ? "سقف حافظه رم (مگابایت / MB)" : "RAM Limit (MB)"}
                  </span>
                  <input
                    type="number"
                    min={64}
                    max={1048576}
                    step="1"
                    dir="ltr"
                    name="ramLimitMb"
                    value={ramLimitMb}
                    onChange={(e) => setRamLimitMb(e.target.value)}
                    placeholder={isFa ? "مثلاً 1024 (خالی = خودکار)" : "e.g. 1024 (blank = auto)"}
                    className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    {isFa ? "سهمیه پردازنده (تعداد هسته vCPU)" : "CPU Allocation (vCPU Cores)"}
                  </span>
                  <input
                    type="number"
                    min={0.1}
                    max={256}
                    step="0.1"
                    dir="ltr"
                    name="cpuCores"
                    value={cpuCores}
                    onChange={(e) => setCpuCores(e.target.value)}
                    placeholder={isFa ? "مثلاً 1 یا 2 (خالی = خودکار)" : "e.g. 1 or 2 (blank = auto)"}
                    className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    {isFa ? "سقف تعداد فایل‌ها (Inodes)" : "Files / Inodes Limit"}
                  </span>
                  <input
                    type="number"
                    min={100}
                    max={100000000}
                    step="1"
                    dir="ltr"
                    name="inodeLimit"
                    value={inodeLimit}
                    onChange={(e) => setInodeLimit(e.target.value)}
                    placeholder={isFa ? "مثلاً 100000 (خالی = خودکار)" : "e.g. 100000 (blank = auto)"}
                    className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    {isFa ? "سقف پردازش همزمان (Entry Processes)" : "Entry Processes (NPROC)"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    step="1"
                    dir="ltr"
                    name="entryProcessLimit"
                    value={entryProcessLimit}
                    onChange={(e) => setEntryProcessLimit(e.target.value)}
                    placeholder={isFa ? "مثلاً 20 (خالی = خودکار)" : "e.g. 20 (blank = auto)"}
                    className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-(--color-text-secondary)">
                    {isFa ? "عنوان پلن (اختیاری)" : "Plan Label (Optional)"}
                  </span>
                  <input
                    type="text"
                    maxLength={80}
                    name="planLabel"
                    value={planLabel}
                    onChange={(e) => setPlanLabel(e.target.value)}
                    placeholder={isFa ? "مثلاً هاست اشتراکی ۵۰۰ مگابایتی" : "e.g. cPanel 500MB Plan"}
                    className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-(--color-border-subtle) pt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleResetAuto()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{isFa ? "بازگشت به تشخیص خودکار" : "Reset to Auto-Detect"}</span>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="save-quota-btn"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>{isFa ? "ذخیره سقف منابع" : "Save Plan Limits"}</span>
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 4 Identical Radial Gauges with Dial Needles for My Allocated Account Quota */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. My Disk Space Quota */}
        <ResourceGauge
          title={isFa ? "فضای دیسک من" : "My Disk Quota"}
          percent={quota?.disk.percent ?? 0}
          primaryStat={
            quota
              ? `${formatBytesCompact(quota.disk.used)} / ${formatBytesCompact(quota.disk.limit)}`
              : "—"
          }
          secondaryStat={
            quota
              ? quota.disk.overLimit
                ? isFa
                  ? `تجاوز از سقف (+${formatBytesCompact(quota.disk.used - quota.disk.limit)})`
                  : `Over limit (+${formatBytesCompact(quota.disk.used - quota.disk.limit)})`
                : isFa
                  ? `باقی‌مانده: ${formatBytesCompact(quota.disk.remaining)}`
                  : `Remaining: ${formatBytesCompact(quota.disk.remaining)}`
              : isFa
                ? "در حال محاسبه…"
                : "Scanning…"
          }
          tertiaryStat={quota ? formatQuotaSourceLabel(quota.disk.source, isFa) : undefined}
          history={diskHistory}
          icon={<HardDrive className="h-4 w-4" />}
          accentHex="#10b981"
          loading={loading}
          isFa={isFa}
        />

        {/* 2. My RAM Quota */}
        <ResourceGauge
          title={isFa ? "حافظه رم مجاز من" : "My RAM Quota"}
          percent={quota?.memory.percent ?? 0}
          primaryStat={
            quota
              ? `${formatBytesCompact(quota.memory.used)} / ${formatBytesCompact(quota.memory.limit)}`
              : "—"
          }
          secondaryStat={
            quota
              ? quota.memory.overLimit
                ? isFa
                  ? `تجاوز از سقف (+${formatBytesCompact(quota.memory.used - quota.memory.limit)})`
                  : `Over limit (+${formatBytesCompact(quota.memory.used - quota.memory.limit)})`
                : isFa
                  ? `باقی‌مانده: ${formatBytesCompact(quota.memory.remaining)}`
                  : `Remaining: ${formatBytesCompact(quota.memory.remaining)}`
              : isFa
                ? "در حال محاسبه…"
                : "Sampling…"
          }
          tertiaryStat={quota ? formatQuotaSourceLabel(quota.memory.source, isFa) : undefined}
          history={ramHistory}
          icon={<MemoryStick className="h-4 w-4" />}
          accentHex="#a78bfa"
          loading={loading}
          isFa={isFa}
        />

        {/* 3. My CPU Allocation */}
        <ResourceGauge
          title={isFa ? "پردازنده مجاز من" : "My CPU Quota"}
          percent={quota?.cpu.percent ?? 0}
          primaryStat={
            quota
              ? `${quota.cpu.percent.toFixed(1)}% · ${quota.cpu.allocatedCores} vCPU`
              : "—"
          }
          secondaryStat={
            quota
              ? isFa
                ? `ظرفیت باقی‌مانده: ${quota.cpu.remainingPercent.toFixed(1)}%`
                : `Remaining headroom: ${quota.cpu.remainingPercent.toFixed(1)}%`
              : isFa
                ? "در حال محاسبه…"
                : "Sampling…"
          }
          tertiaryStat={quota ? formatQuotaSourceLabel(quota.cpu.source, isFa) : undefined}
          history={cpuHistory}
          icon={<Cpu className="h-4 w-4" />}
          accentHex="#38bdf8"
          loading={loading}
          isFa={isFa}
        />

        {/* 4. My Inodes / Files Quota */}
        <ResourceGauge
          title={isFa ? "فایل‌ها و Inodes من" : "My Files / Inodes"}
          percent={quota?.inodes.percent ?? 0}
          primaryStat={
            quota
              ? `${formatCountCompact(quota.inodes.used)} / ${formatCountCompact(quota.inodes.limit)}`
              : "—"
          }
          secondaryStat={
            quota
              ? isFa
                ? `باقی‌مانده: ${formatCountCompact(quota.inodes.remaining)} فایل`
                : `Remaining: ${formatCountCompact(quota.inodes.remaining)} files`
              : isFa
                ? "در حال شمارش…"
                : "Counting…"
          }
          tertiaryStat={quota ? formatQuotaSourceLabel(quota.inodes.source, isFa) : undefined}
          history={inodeHistory}
          icon={<Files className="h-4 w-4" />}
          accentHex="#2dd4bf"
          loading={loading}
          isFa={isFa}
        />
      </div>

      {/* Compact Account Quota Breakdown & Top Folder Consumption Strip */}
      <div className="grid grid-cols-1 divide-y divide-(--color-border-subtle) rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:grid-cols-2 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
        {/* Left Half: Exact Used vs Remaining Bars + Entry Processes */}
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-(--color-text-secondary)">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-(--color-accent-cyan)" />
              {isFa ? "خلاصه مصرف و مانده سهمیه اکانت" : "Account Allocation Summary"}
            </span>
            <span
              dir="ltr"
              className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)"
            >
              {quota
                ? isFa
                  ? `پردازش همزمان: ${quota.processes.used} / ${quota.processes.limit}`
                  : `Entry Procs: ${quota.processes.used} / ${quota.processes.limit}`
                : "—"}
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Disk Used vs Remaining */}
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-(--color-text-secondary)">
                  {isFa ? "دیسک اکانت" : "Account Disk"}
                </span>
                <span
                  dir="ltr"
                  className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)"
                >
                  {quota
                    ? isFa
                      ? `${formatBytesCompact(quota.disk.used)} مصرف · ${formatBytesCompact(quota.disk.remaining)} مانده از ${formatBytesCompact(quota.disk.limit)}`
                      : `${formatBytesCompact(quota.disk.used)} used · ${formatBytesCompact(quota.disk.remaining)} left of ${formatBytesCompact(quota.disk.limit)}`
                    : "—"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-deep)">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColorClass(quota?.disk.percent ?? 0, "bg-emerald-400")}`}
                  style={{ width: `${Math.min(100, quota?.disk.percent ?? 0)}%` }}
                />
              </div>
            </div>

            {/* RAM Used vs Remaining */}
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-(--color-text-secondary)">
                  {isFa ? "حافظه رم اکانت" : "Account RAM"}
                </span>
                <span
                  dir="ltr"
                  className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)"
                >
                  {quota
                    ? isFa
                      ? `${formatBytesCompact(quota.memory.used)} مصرف · ${formatBytesCompact(quota.memory.remaining)} مانده از ${formatBytesCompact(quota.memory.limit)}`
                      : `${formatBytesCompact(quota.memory.used)} used · ${formatBytesCompact(quota.memory.remaining)} left of ${formatBytesCompact(quota.memory.limit)}`
                    : "—"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-deep)">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColorClass(quota?.memory.percent ?? 0, "bg-violet-400")}`}
                  style={{ width: `${Math.min(100, quota?.memory.percent ?? 0)}%` }}
                />
              </div>
            </div>

            {/* Entry Processes Used vs Remaining */}
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-(--color-text-secondary)">
                  {isFa ? "پردازش‌های همزمان (Entry Processes)" : "Entry Processes (NPROC)"}
                </span>
                <span
                  dir="ltr"
                  className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)"
                >
                  {quota
                    ? isFa
                      ? `${formatCountCompact(quota.processes.used)} فعال · ${formatCountCompact(quota.processes.remaining)} مانده از ${formatCountCompact(quota.processes.limit)}`
                      : `${formatCountCompact(quota.processes.used)} active · ${formatCountCompact(quota.processes.remaining)} left of ${formatCountCompact(quota.processes.limit)}`
                    : "—"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-deep)">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColorClass(quota?.processes.percent ?? 0, "bg-sky-400")}`}
                  style={{ width: `${Math.min(100, quota?.processes.percent ?? 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Half: Top Workspace Folders Consuming Account Disk */}
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-(--color-text-secondary)">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-emerald-400" />
              {isFa ? "پرمصرف‌ترین پوشه‌های فضای اکانت" : "Top Disk Consumers in Account"}
            </span>
            <span
              dir="ltr"
              className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)"
            >
              {quota ? formatBytesCompact(quota.disk.workspaceBytes) : "—"}
            </span>
          </div>

          {quota && quota.disk.breakdown.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
              {quota.disk.breakdown.slice(0, 6).map((dir) => (
                <div key={dir.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span
                      dir="ltr"
                      className="truncate font-[family-name:var(--font-mono)] text-(--color-text-secondary)"
                    >
                      {dir.name}
                    </span>
                    <span
                      dir="ltr"
                      className="shrink-0 font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)"
                    >
                      {formatBytesCompact(dir.bytes)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-(--color-bg-deep)">
                    <div
                      className="h-full rounded-full bg-emerald-400/80 transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(2, Math.min(100, dir.percentOfLimit))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-20 items-center justify-center text-xs text-(--color-text-tertiary)">
              {isFa ? "در حال بررسی پوشه‌های اکانت…" : "Scanning account directories…"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
