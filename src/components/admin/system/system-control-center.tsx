"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  GitBranch,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Rocket,
  Lock,
  Globe,
  Pause,
  Play,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  SkipForward,
  CircleDashed,
  Trash2,
  Database,
  Save,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { useAdminLocale } from "@/components/admin/admin-locale-context";
import { adminFetch } from "@/lib/admin-api-client";
import { ResourceGauge } from "./resource-gauge";
import { TelemetryOverviewBar } from "./telemetry-overview-bar";
import { AccountQuotaSection } from "./account-quota-section";
import {
  formatBytesCompact,
  validateGithubRepoUrl,
  type DeployJobRecord,
  type RepoVisibility,
  type UpdaterConfig,
} from "@/lib/system-updater-core";
import type { SystemTelemetrySnapshot } from "@/lib/system-telemetry";
import type { LocalGitStatus, SshKeyPublicStatus, UpdateCheckResult } from "@/lib/system-updater";
import type { DatabaseDiagnostics, DatabaseMaintenanceResult } from "@/lib/db-optimizer";

interface UpdaterStateResponse {
  config: UpdaterConfig;
  localGit: LocalGitStatus;
  sshKey: SshKeyPublicStatus;
  activeJob: DeployJobRecord | null;
  history: DeployJobRecord[];
}

function formatUptime(sec: number, isFa: boolean): string {
  const s = Math.max(0, Math.floor(sec));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const remSec = s % 60;
  if (isFa) {
    if (days > 0) return `${days} روز ${hours} ساعت ${mins} دقیقه`;
    if (hours > 0) return `${hours} ساعت ${mins} دقیقه ${remSec} ثانیه`;
    return `${mins} دقیقه ${remSec} ثانیه`;
  }
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${remSec}s`;
  return `${mins}m ${remSec}s`;
}

function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestampShort(iso: string | null, isFa: boolean): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(isFa ? "fa-IR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

export function SystemControlCenter() {
  const { isFa } = useAdminLocale();

  // Real-time hardware telemetry state
  const [telemetry, setTelemetry] = useState<SystemTelemetrySnapshot | null>(null);
  const [streamState, setStreamState] = useState<"connecting" | "live" | "paused" | "reconnecting">("connecting");
  const [intervalMs, setIntervalMs] = useState<number>(2000);
  const [paused, setPaused] = useState<boolean>(false);
  const [samplingNow, setSamplingNow] = useState<boolean>(false);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [diskHistory, setDiskHistory] = useState<number[]>([]);
  const [heapHistory, setHeapHistory] = useState<number[]>([]);
  const [accountDiskHistory, setAccountDiskHistory] = useState<number[]>([]);
  const [accountRamHistory, setAccountRamHistory] = useState<number[]>([]);
  const [accountCpuHistory, setAccountCpuHistory] = useState<number[]>([]);
  const [accountInodeHistory, setAccountInodeHistory] = useState<number[]>([]);

  // Updater & SSH state
  const [loadingState, setLoadingState] = useState(true);
  const [localGit, setLocalGit] = useState<LocalGitStatus | null>(null);
  const [sshKey, setSshKey] = useState<SshKeyPublicStatus | null>(null);
  const [activeJob, setActiveJob] = useState<DeployJobRecord | null>(null);
  const [history, setHistory] = useState<DeployJobRecord[]>([]);

  // Editable config form
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [visibility, setVisibility] = useState<RepoVisibility>("public");
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const [autoBuild, setAutoBuild] = useState(true);
  const [autoOptimizeDb, setAutoOptimizeDb] = useState(true);

  // Action feedback states
  const [savingConfig, setSavingConfig] = useState(false);
  const [checkingRemote, setCheckingRemote] = useState(false);
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [startingDeploy, setStartingDeploy] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [confirmRevokeKey, setConfirmRevokeKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Database health card state
  const [dbDiag, setDbDiag] = useState<DatabaseDiagnostics | null>(null);
  const [optimizingDb, setOptimizingDb] = useState(false);
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  const loadUpdaterState = useCallback(async (syncForm: boolean) => {
    try {
      const data = await adminFetch<UpdaterStateResponse>("/api/admin/system/updater");
      setLocalGit(data.localGit);
      setSshKey(data.sshKey);
      setActiveJob(data.activeJob);
      setHistory(data.history ?? []);
      if (syncForm) {
        setRepoUrl(data.config.repoUrl || data.localGit.remoteOriginUrl || "");
        setBranch(data.config.branch || data.localGit.currentBranch || "main");
        setVisibility(data.config.visibility);
        setAutoInstallDeps(data.config.autoInstallDeps);
        setAutoBuild(data.config.autoBuild);
        setAutoOptimizeDb(data.config.autoOptimizeDb);
      }
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : isFa ? "خطا در بارگذاری وضعیت سیستم" : "Failed to load system state",
      });
    } finally {
      setLoadingState(false);
    }
  }, [isFa]);

  const loadDbDiagnostics = useCallback(async () => {
    try {
      const diag = await adminFetch<DatabaseDiagnostics>("/api/admin/database");
      setDbDiag(diag);
    } catch {
      // Non-fatal if user lacks cache.manage permission
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, diag] = await Promise.all([
          adminFetch<UpdaterStateResponse>("/api/admin/system/updater"),
          adminFetch<DatabaseDiagnostics>("/api/admin/database").catch(() => null),
        ]);
        if (cancelled) return;
        setLocalGit(data.localGit);
        setSshKey(data.sshKey);
        setActiveJob(data.activeJob);
        setHistory(data.history ?? []);
        setRepoUrl(data.config.repoUrl || data.localGit.remoteOriginUrl || "");
        setBranch(data.config.branch || data.localGit.currentBranch || "main");
        setVisibility(data.config.visibility);
        setAutoInstallDeps(data.config.autoInstallDeps);
        setAutoBuild(data.config.autoBuild);
        setAutoOptimizeDb(data.config.autoOptimizeDb);
        if (diag) setDbDiag(diag);
      } catch (err) {
        if (!cancelled) {
          setNotice({
            type: "error",
            text: err instanceof Error ? err.message : isFa ? "خطا در بارگذاری وضعیت سیستم" : "Failed to load system state",
          });
        }
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFa]);

  // Real-time LiteSpeed/cPanel-safe telemetry polling (short-lived <10ms JSON snapshots
  // instead of persistent SSE streams, preventing Entry Process & NPROC exhaustion on shared hosts).
  useEffect(() => {
    if (paused) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;

    const scheduleNext = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void pollOnce();
      }, intervalMs);
    };

    const pollOnce = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        scheduleNext();
        return;
      }

      activeController = new AbortController();
      try {
        const res = await fetch("/api/admin/system/telemetry?mode=snapshot", {
          credentials: "same-origin",
          cache: "no-store",
          signal: activeController.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snap = (await res.json()) as SystemTelemetrySnapshot;
        if (cancelled) return;
        setTelemetry(snap);
        setStreamState("live");
        setCpuHistory((prev) => [...prev.slice(-29), snap.cpu.percent]);
        setRamHistory((prev) => [...prev.slice(-29), snap.memory.percent]);
        setDiskHistory((prev) => [...prev.slice(-29), snap.disk.percent]);
        setHeapHistory((prev) => [...prev.slice(-29), snap.runtime.heapPercent]);
        if (snap.accountQuota) {
          setAccountDiskHistory((prev) => [...prev.slice(-29), snap.accountQuota.disk.percent]);
          setAccountRamHistory((prev) => [...prev.slice(-29), snap.accountQuota.memory.percent]);
          setAccountCpuHistory((prev) => [...prev.slice(-29), snap.accountQuota.cpu.percent]);
          setAccountInodeHistory((prev) => [...prev.slice(-29), snap.accountQuota.inodes.percent]);
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setStreamState("reconnecting");
        }
      } finally {
        activeController = null;
        scheduleNext();
      }
    };

    const handleVisibilityChange = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void pollOnce();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    void pollOnce();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      activeController?.abort();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [intervalMs, paused]);

  const handleSampleNow = useCallback(async () => {
    setSamplingNow(true);
    try {
      const snap = await adminFetch<SystemTelemetrySnapshot>(
        "/api/admin/system/telemetry?mode=snapshot"
      );
      setTelemetry(snap);
      setCpuHistory((prev) => [...prev.slice(-29), snap.cpu.percent]);
      setRamHistory((prev) => [...prev.slice(-29), snap.memory.percent]);
      setDiskHistory((prev) => [...prev.slice(-29), snap.disk.percent]);
      setHeapHistory((prev) => [...prev.slice(-29), snap.runtime.heapPercent]);
      if (snap.accountQuota) {
        setAccountDiskHistory((prev) => [...prev.slice(-29), snap.accountQuota.disk.percent]);
        setAccountRamHistory((prev) => [...prev.slice(-29), snap.accountQuota.memory.percent]);
        setAccountCpuHistory((prev) => [...prev.slice(-29), snap.accountQuota.cpu.percent]);
        setAccountInodeHistory((prev) => [...prev.slice(-29), snap.accountQuota.inodes.percent]);
      }
    } catch {
      // Ignore transient manual sample error
    } finally {
      setSamplingNow(false);
    }
  }, []);

  // Poll updater job progress while a deployment is actively running
  const isJobRunning = activeJob?.status === "running";
  useEffect(() => {
    if (!isJobRunning) return;
    const timer = setInterval(() => {
      void loadUpdaterState(false);
    }, 1200);
    return () => clearInterval(timer);
  }, [isJobRunning, loadUpdaterState]);

  // Auto-scroll live console to newest line while deploying
  const logCount = activeJob?.logs.length ?? 0;
  useEffect(() => {
    if (logContainerRef.current && logCount > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logCount]);

  function handleVisibilityToggle(nextVis: RepoVisibility) {
    setVisibility(nextVis);
    if (repoUrl.trim()) {
      const parsed = validateGithubRepoUrl(repoUrl, nextVis);
      if (parsed.ok) {
        setRepoUrl(parsed.repo.normalizedUrl);
      }
    }
  }

  async function handleSaveConfig(e?: React.FormEvent) {
    e?.preventDefault();
    setNotice(null);
    setSavingConfig(true);
    try {
      const res = await adminFetch<{ config: UpdaterConfig }>("/api/admin/system/updater", {
        method: "PUT",
        body: JSON.stringify({
          repoUrl,
          branch,
          visibility,
          autoInstallDeps,
          autoBuild,
          autoOptimizeDb,
        }),
      });
      setRepoUrl(res.config.repoUrl);
      setBranch(res.config.branch);
      setVisibility(res.config.visibility);
      setNotice({
        type: "success",
        text: isFa ? "تنظیمات مخزن گیت‌هاب با موفقیت ذخیره شد." : "GitHub repository configuration saved.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : isFa ? "خطا در ذخیره تنظیمات" : "Failed to save configuration",
      });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleCheckGithub() {
    setNotice(null);
    setCheckingRemote(true);
    setCheckResult(null);
    try {
      const res = await adminFetch<UpdateCheckResult>("/api/admin/system/updater", {
        method: "POST",
        body: JSON.stringify({
          action: "check",
          repoUrl,
          branch,
          visibility,
        }),
      });
      setCheckResult(res);
      if (res.reachable && !res.error) {
        setRepoUrl(res.repoUrl);
        setBranch(res.branch);
      }
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : isFa ? "خطا در بررسی مخزن گیت‌هاب" : "Failed to check GitHub",
      });
    } finally {
      setCheckingRemote(false);
    }
  }

  async function handleStartDeploy() {
    setNotice(null);
    setStartingDeploy(true);
    setConfirmDeploy(false);
    try {
      // Save latest form settings before starting deploy
      await adminFetch("/api/admin/system/updater", {
        method: "PUT",
        body: JSON.stringify({
          repoUrl,
          branch,
          visibility,
          autoInstallDeps,
          autoBuild,
          autoOptimizeDb,
        }),
      });

      const res = await adminFetch<{ job: DeployJobRecord }>("/api/admin/system/updater", {
        method: "POST",
        body: JSON.stringify({ action: "update" }),
      });
      setActiveJob(res.job);
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : isFa ? "خطا در شروع بروزرسانی" : "Failed to start site update",
      });
    } finally {
      setStartingDeploy(false);
    }
  }

  async function handleGenerateSshKey() {
    setNotice(null);
    setGeneratingKey(true);
    try {
      const next = await adminFetch<SshKeyPublicStatus>("/api/admin/system/ssh-key", {
        method: "POST",
        body: JSON.stringify({ comment: "scienta-panel-deploy" }),
      });
      setSshKey(next);
      setNotice({
        type: "success",
        text: isFa
          ? "کلید SSH جدید (Ed25519) تولید شد. کلید عمومی را در بخش Deploy Keys مخزن گیت‌هاب خود وارد کنید."
          : "New Ed25519 SSH Deploy Key generated. Add the public key to GitHub → Settings → Deploy keys.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : isFa ? "خطا در تولید کلید SSH" : "Failed to generate SSH key",
      });
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleDeleteSshKey() {
    setNotice(null);
    setConfirmRevokeKey(false);
    setGeneratingKey(true);
    try {
      const next = await adminFetch<SshKeyPublicStatus>("/api/admin/system/ssh-key", {
        method: "DELETE",
      });
      setSshKey(next);
      setNotice({
        type: "success",
        text: isFa ? "کلید SSH از سرور حذف شد." : "SSH Deploy Key removed from server.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : isFa ? "خطا در حذف کلید SSH" : "Failed to remove SSH key",
      });
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleCopyPublicKey() {
    if (!sshKey?.publicKey) return;
    try {
      await navigator.clipboard.writeText(sshKey.publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Fallback ignored
    }
  }

  async function handleCopyLogs() {
    if (!activeJob?.logs.length) return;
    try {
      await navigator.clipboard.writeText(activeJob.logs.join("\n"));
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // Fallback ignored
    }
  }

  async function handleRunDbOptimize() {
    setOptimizingDb(true);
    setDbMessage(null);
    try {
      const res = await adminFetch<DatabaseMaintenanceResult>("/api/admin/database", {
        method: "POST",
      });
      await loadDbDiagnostics();
      setDbMessage(
        isFa
          ? `بهینه‌سازی دیتابیس انجام شد (${res.prunedExpiredRefreshTokens} نشست منقضی پاک‌سازی شد).`
          : `Database optimized (${res.prunedExpiredRefreshTokens} expired sessions pruned).`
      );
    } catch (err) {
      setDbMessage(err instanceof Error ? err.message : isFa ? "خطا در بهینه‌سازی دیتابیس" : "Optimization failed");
    } finally {
      setOptimizingDb(false);
    }
  }

  const effectiveStreamState = paused ? "paused" : streamState;

  const streamLabel =
    effectiveStreamState === "live"
      ? isFa
        ? "زنده (Real-Time)"
        : "Live Stream"
      : effectiveStreamState === "paused"
        ? isFa
          ? "متوقف"
          : "Paused"
        : effectiveStreamState === "reconnecting"
          ? isFa
            ? "تلاش مجدد…"
            : "Reconnecting…"
          : isFa
            ? "در حال اتصال…"
            : "Connecting…";

  const streamDotColor =
    effectiveStreamState === "live"
      ? "bg-emerald-400"
      : effectiveStreamState === "paused"
        ? "bg-zinc-500"
        : "bg-amber-400";

  return (
    <div className="space-y-6">
      {/* Top Control Header */}
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-(--color-text-primary) sm:text-2xl">
            {isFa ? "مرکز کنترل سیستم و بروزرسانی سرور" : "System Telemetry & GitHub Deploy"}
          </h1>
          <p className="mt-1 text-xs text-(--color-text-secondary) sm:text-sm">
            {isFa
              ? "پایش لحظه‌ای منابع سخت‌افزاری سرور و ارتقای مستقیم نسخه وب‌سایت از مخزن عمومی یا خصوصی گیت‌هاب."
              : "Real-time hardware telemetry and one-click website upgrades from public or private GitHub repositories."}
          </p>
        </div>

        {/* Real-Time Stream Controls */}
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-2.5 text-xs text-(--color-text-secondary)">
            <span className={`h-2 w-2 shrink-0 rounded-full ${streamDotColor}`} aria-hidden="true" />
            <span className="whitespace-nowrap font-medium">{streamLabel}</span>
          </div>

          <div
            className="flex items-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-0.5"
            role="group"
            aria-label={isFa ? "بازه بروزرسانی لحظه‌ای" : "Live refresh interval"}
          >
            {[1000, 2000, 5000].map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => setIntervalMs(ms)}
                className={`rounded-md px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums transition-colors whitespace-nowrap sm:px-2.5 ${
                  intervalMs === ms
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {ms / 1000}s
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleSampleNow()}
            disabled={samplingNow}
            aria-label={isFa ? "بروزرسانی فوری آمار سرور" : "Sample server metrics now"}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-2.5 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:opacity-50 whitespace-nowrap shrink-0 sm:px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${samplingNow ? "animate-spin" : ""}`} />
            <span>{isFa ? "بروزرسانی" : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-2.5 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap shrink-0 sm:px-3"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span>{paused ? (isFa ? "ادامه" : "Resume") : isFa ? "توقف" : "Pause"}</span>
          </button>
        </div>
      </div>

      {/* Top Row: 3x-ui-style Real-Time Hardware Gauges (Whole Host / Shared Server) */}
      <section aria-label={isFa ? "منابع لحظه‌ای کل سرور" : "Real-time host server resources"}>
        <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold text-(--color-text-primary)">
            {isFa ? "منابع کل سرور (هاست اشتراکی)" : "Host Server Resources (Shared Node)"}
          </h2>
          <span className="hidden text-xs text-(--color-text-tertiary) sm:inline">·</span>
          <span className="text-xs text-(--color-text-tertiary)">
            {isFa ? "ظرفیت کلی سخت‌افزار سرور میزبان" : "Physical host node hardware totals"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ResourceGauge
            title={isFa ? "مصرف پردازنده (CPU)" : "CPU Usage"}
            percent={telemetry?.cpu.percent ?? 0}
            primaryStat={
              telemetry
                ? `${telemetry.cpu.cores} Cores · Load ${telemetry.cpu.loadAvg.join(" / ")}`
                : "—"
            }
            secondaryStat={telemetry?.cpu.model ?? (isFa ? "در حال دریافت…" : "Sampling…")}
            history={cpuHistory}
            icon={<Cpu className="h-4 w-4" />}
            accentHex="#38bdf8"
            loading={!telemetry}
            isFa={isFa}
          />

          <ResourceGauge
            title={isFa ? "حافظه رم (RAM)" : "Memory (RAM)"}
            percent={telemetry?.memory.percent ?? 0}
            primaryStat={
              telemetry
                ? `${formatBytesCompact(telemetry.memory.usedBytes)} / ${formatBytesCompact(telemetry.memory.totalBytes)}`
                : "—"
            }
            secondaryStat={
              telemetry
                ? isFa
                  ? `آزاد: ${formatBytesCompact(telemetry.memory.freeBytes)}`
                  : `Available: ${formatBytesCompact(telemetry.memory.freeBytes)}`
                : isFa
                  ? "در حال دریافت…"
                  : "Sampling…"
            }
            tertiaryStat={
              telemetry && telemetry.memory.swapTotalBytes > 0
                ? `Swap ${telemetry.memory.swapPercent.toFixed(0)}%`
                : undefined
            }
            history={ramHistory}
            icon={<MemoryStick className="h-4 w-4" />}
            accentHex="#a78bfa"
            loading={!telemetry}
            isFa={isFa}
          />

          <ResourceGauge
            title={isFa ? "فضای دیسک (Disk)" : "Disk Storage"}
            percent={telemetry?.disk.percent ?? 0}
            primaryStat={
              telemetry
                ? `${formatBytesCompact(telemetry.disk.usedBytes)} / ${formatBytesCompact(telemetry.disk.totalBytes)}`
                : "—"
            }
            secondaryStat={
              telemetry
                ? isFa
                  ? `فضای خالی: ${formatBytesCompact(telemetry.disk.freeBytes)}`
                  : `Free: ${formatBytesCompact(telemetry.disk.freeBytes)}`
                : isFa
                  ? "در حال دریافت…"
                  : "Sampling…"
            }
            tertiaryStat={
              telemetry
                ? isFa
                  ? `پارتیشن ریشه`
                  : `Mount ${telemetry.disk.mountLabel}`
                : undefined
            }
            history={diskHistory}
            icon={<HardDrive className="h-4 w-4" />}
            accentHex="#10b981"
            loading={!telemetry}
            isFa={isFa}
          />

          <ResourceGauge
            title={isFa ? "حافظه پردازش سرور" : "Node Runtime Heap"}
            percent={telemetry?.runtime.heapPercent ?? 0}
            primaryStat={
              telemetry
                ? `${formatBytesCompact(telemetry.runtime.heapUsedBytes)} / ${formatBytesCompact(telemetry.runtime.heapLimitBytes || telemetry.runtime.heapTotalBytes)}`
                : "—"
            }
            secondaryStat={
              telemetry
                ? `RSS ${formatBytesCompact(telemetry.runtime.processRssBytes)}`
                : isFa
                  ? "در حال دریافت…"
                  : "Sampling…"
            }
            tertiaryStat={
              telemetry
                ? isFa
                  ? `آپتایم: ${formatUptime(telemetry.runtime.osUptimeSec, true)}`
                  : `Up ${formatUptime(telemetry.runtime.osUptimeSec, false)}`
                : undefined
            }
            history={heapHistory}
            icon={<Activity className="h-4 w-4" />}
            accentHex="#2dd4bf"
            loading={!telemetry}
            isFa={isFa}
          />
        </div>

        {/* 3x-ui Secondary Overview Strip: System Load, Live Network I/O, Capacity Bars & Runtime */}
        <TelemetryOverviewBar
          telemetry={telemetry}
          localGit={localGit}
          dbEngineFallback={dbDiag?.engine}
          isFa={isFa}
          formatUptime={formatUptime}
        />

        {/* Per-Account / Hosting Plan Resource Quota Gauges & Breakdown */}
        <AccountQuotaSection
          quota={telemetry?.accountQuota}
          diskHistory={accountDiskHistory}
          ramHistory={accountRamHistory}
          cpuHistory={accountCpuHistory}
          inodeHistory={accountInodeHistory}
          isFa={isFa}
          onQuotaSaved={handleSampleNow}
        />
      </section>

      {/* Global Action Notice */}
      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            {isFa ? "بستن" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Main Operations Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left/Primary Column: GitHub Release Updater + Live Console */}
        <section className="space-y-6 xl:col-span-7">
          <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-border-subtle) pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-(--color-text-primary)">
                  <GitBranch className="h-4 w-4 text-(--color-accent-purple)" />
                  <span>{isFa ? "بروزرسانی مستقیم کد سایت از گیت‌هاب" : "GitHub Release & Version Updater"}</span>
                </h2>
                <p className="mt-1 text-xs text-(--color-text-secondary)">
                  {isFa
                    ? "سرور آخرین کد را از مخزن عمومی (HTTPS) یا خصوصی (SSH) دریافت کرده و نسخه جدید را آماده می‌کند."
                    : "Pull the latest code from a public HTTPS or private SSH GitHub repository directly on the server."}
                </p>
              </div>

              {/* Public vs Private Segmented Control */}
              <div className="flex items-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-1">
                <button
                  type="button"
                  onClick={() => handleVisibilityToggle("public")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    visibility === "public"
                      ? "bg-(--color-accent-purple) text-white"
                      : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{isFa ? "عمومی (HTTPS)" : "Public (HTTPS)"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleVisibilityToggle("private")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    visibility === "private"
                      ? "bg-(--color-accent-purple) text-white"
                      : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{isFa ? "خصوصی (SSH)" : "Private (SSH)"}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <label
                    htmlFor="github-repo-url"
                    className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)"
                  >
                    {isFa ? "نشانی مخزن گیت‌هاب (Repository URL)" : "GitHub Repository URL"}
                  </label>
                  <input
                    id="github-repo-url"
                    type="text"
                    dir="ltr"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder={
                      visibility === "private"
                        ? "git@github.com:username/scienta.git"
                        : "https://github.com/username/scienta.git"
                    }
                    className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="github-branch"
                    className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)"
                  >
                    {isFa ? "شاخه هدف (Branch)" : "Target Branch"}
                  </label>
                  <input
                    id="github-branch"
                    type="text"
                    dir="ltr"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </div>
              </div>

              {/* Pipeline Options */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs text-(--color-text-secondary)">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoInstallDeps}
                    onChange={(e) => setAutoInstallDeps(e.target.checked)}
                    className="h-4 w-4 rounded border-(--color-border-strong) accent-(--color-accent-purple)"
                  />
                  <span>{isFa ? "نصب وابستگی‌ها (npm install)" : "Install dependencies (npm install)"}</span>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoBuild}
                    onChange={(e) => setAutoBuild(e.target.checked)}
                    className="h-4 w-4 rounded border-(--color-border-strong) accent-(--color-accent-purple)"
                  />
                  <span>{isFa ? "بیلد نهایی (npm run build)" : "Production build (npm run build)"}</span>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoOptimizeDb}
                    onChange={(e) => setAutoOptimizeDb(e.target.checked)}
                    className="h-4 w-4 rounded border-(--color-border-strong) accent-(--color-accent-purple)"
                  />
                  <span>{isFa ? "بهینه‌سازی دیتابیس پس از آپدیت" : "Optimize DB post-deploy"}</span>
                </label>
              </div>

              {/* Private Mode Warning if SSH Key Missing */}
              {visibility === "private" && sshKey && !sshKey.exists && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    {isFa
                      ? "برای اتصال به مخزن خصوصی، ابتدا از کادر «کلید SSH پنل» یک کلید تولید کنید و کلید عمومی آن را در گیت‌هاب وارد نمایید."
                      : "Generate an SSH Deploy Key in the right panel first and add its public key to your private GitHub repository."}
                  </span>
                </div>
              )}

              {/* Check Result Banner */}
              {checkResult && (
                <div
                  className={`rounded-lg border px-3.5 py-3 text-xs ${
                    checkResult.reachable && !checkResult.error
                      ? checkResult.updateAvailable
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-red-500/30 bg-red-500/10 text-red-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {checkResult.reachable && !checkResult.error
                        ? checkResult.updateAvailable
                          ? isFa
                            ? "نسخه جدید روی گیت‌هاب آماده دریافت است"
                            : "New update available on GitHub"
                          : isFa
                            ? "سرور در حال حاضر روی آخرین نسخه قرار دارد"
                            : "Server is up to date with GitHub"
                        : isFa
                          ? "اتصال به گیت‌هاب برقرار نشد"
                          : "GitHub check failed"}
                    </span>
                    {checkResult.remoteCommitShort && (
                      <span dir="ltr" className="font-[family-name:var(--font-mono)] text-[11px]">
                        HEAD: {checkResult.remoteCommitShort}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 opacity-85">{checkResult.error || checkResult.message}</p>
                </div>
              )}

              {/* Primary Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-subtle) pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingConfig || isJobRunning}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-xs font-medium text-(--color-text-primary) transition-colors hover:border-(--color-border-strong) disabled:opacity-50 whitespace-nowrap"
                  >
                    {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>{isFa ? "ذخیره تنظیمات" : "Save Settings"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckGithub}
                    disabled={checkingRemote || !repoUrl.trim() || isJobRunning}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-xs font-medium text-(--color-text-primary) transition-colors hover:border-(--color-border-strong) disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${checkingRemote ? "animate-spin" : ""}`} />
                    <span>{isFa ? "تست اتصال و بررسی نسخه" : "Test & Check Updates"}</span>
                  </button>
                </div>

                {/* Safe 2-Click Deploy CTA */}
                {!confirmDeploy ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeploy(true)}
                    disabled={!repoUrl.trim() || isJobRunning || startingDeploy}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isJobRunning || startingDeploy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Rocket className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isJobRunning
                        ? isFa
                          ? "در حال بروزرسانی…"
                          : "Updating…"
                        : isFa
                          ? "بروزرسانی نسخه سایت"
                          : "Update Website Now"}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeploy(false)}
                      className="h-9 rounded-lg border border-(--color-border-subtle) px-3 text-xs font-medium text-(--color-text-secondary) hover:text-(--color-text-primary) whitespace-nowrap"
                    >
                      {isFa ? "انصراف" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={handleStartDeploy}
                      disabled={startingDeploy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 whitespace-nowrap"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isFa ? "تأیید و شروع آپدیت" : "Confirm Deploy"}</span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Live Deployment Pipeline & Console */}
          <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-(--color-accent-purple)" />
                <h2 className="text-base font-semibold text-(--color-text-primary)">
                  {isFa ? "مراحل و کنسول زنده استقرار" : "Live Deployment Pipeline & Console"}
                </h2>
              </div>

              {activeJob && (
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={`font-medium ${
                      activeJob.status === "success"
                        ? "text-emerald-400"
                        : activeJob.status === "error"
                          ? "text-red-400"
                          : "text-sky-400"
                    }`}
                  >
                    {activeJob.status === "running"
                      ? isFa
                        ? "در حال اجرا…"
                        : "Running…"
                      : activeJob.status === "success"
                        ? isFa
                          ? "بروزرسانی موفق"
                          : "Succeeded"
                        : isFa
                          ? "توقف با خطا"
                          : "Failed"}
                  </span>
                  {activeJob.logs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyLogs}
                      className="inline-flex items-center gap-1 text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                    >
                      {copiedLogs ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedLogs ? (isFa ? "کپی شد" : "Copied") : isFa ? "کپی لاگ" : "Copy logs"}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {!activeJob ? (
              <div className="py-8 text-center text-xs text-(--color-text-tertiary)">
                {loadingState
                  ? isFa
                    ? "در حال بارگذاری وضعیت استقرار…"
                    : "Loading deployment status…"
                  : isFa
                    ? "هنوز عملیات بروزرسانی در این نشست اجرا نشده است. پس از تنظیم آدرس مخزن گیت‌هاب، دکمه «بروزرسانی نسخه سایت» را بزنید تا مراحل به‌صورت زنده نمایش داده شوند."
                    : "No active update job yet. Configure your GitHub repository above and click “Update Website Now” to watch live pipeline logs."}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Stepper List */}
                <div className="divide-y divide-(--color-border-subtle) rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep)/60">
                  {activeJob.steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {step.status === "running" ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-400" />
                        ) : step.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : step.status === "error" ? (
                          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                        ) : step.status === "skipped" ? (
                          <SkipForward className="h-4 w-4 shrink-0 text-(--color-text-tertiary)" />
                        ) : (
                          <CircleDashed className="h-4 w-4 shrink-0 text-(--color-text-tertiary)" />
                        )}
                        <span className="truncate font-medium text-(--color-text-primary)">
                          {isFa ? step.labelFa : step.labelEn}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                        {step.detail && (
                          <span className="hidden max-w-[200px] truncate sm:inline">{step.detail}</span>
                        )}
                        <span>{formatDurationMs(step.durationMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live Monospace Console */}
                <div
                  ref={logContainerRef}
                  dir="ltr"
                  className="max-h-64 overflow-y-auto rounded-lg border border-(--color-border-subtle) bg-[#06060b] p-3.5 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-zinc-300"
                >
                  {activeJob.logs.length === 0 ? (
                    <span className="text-zinc-500">Waiting for output…</span>
                  ) : (
                    activeJob.logs.map((line, i) => (
                      <div
                        key={`${i}-${line.slice(0, 12)}`}
                        className={`whitespace-pre-wrap break-all ${
                          line.includes("ERROR:") ? "text-red-400" : ""
                        }`}
                      >
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right/Secondary Column: SSH Deploy Key Vault + DB Health */}
        <aside className="space-y-6 xl:col-span-5">
          {/* SSH Deploy Key Vault */}
          <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-6">
            <div className="flex items-start justify-between gap-3 border-b border-(--color-border-subtle) pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-(--color-text-primary)">
                  <KeyRound className="h-4 w-4 text-(--color-accent-purple)" />
                  <span>{isFa ? "کلید SSH پنل (ریپازیتوری پرایوت)" : "Panel SSH Deploy Key"}</span>
                </h2>
                <p className="mt-1 text-xs text-(--color-text-secondary)">
                  {isFa
                    ? "کلید خصوصی با دسترسی محدود روی سرور نگهداری می‌شود و هرگز نمایش داده نمی‌شود."
                    : "The private key stays strictly on the server (0600) and is never exposed to browsers."}
                </p>
              </div>
            </div>

            {sshKey && !sshKey.sshBinaryAvailable && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  {isFa
                    ? "کلاینت ssh روی این کانتینر پیش‌نمایش نصب نیست؛ کلید Ed25519 تولیدشده کاملاً معتبر است و روی سرور لینوکس اصلی (با openssh-client) بلافاصله کار می‌کند."
                    : "OpenSSH client is not installed in this container; generated Ed25519 keys are production-ready once `openssh-client` is present on your VPS."}
                </span>
              </div>
            )}

            {sshKey?.exists && sshKey.publicKey ? (
              <div className="mt-4 space-y-4">
                {/* Key Metadata (unboxed text with · separators) */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-(--color-text-secondary)">
                  <span className="font-[family-name:var(--font-mono)] font-medium text-emerald-400">
                    Ed25519
                  </span>
                  <span aria-hidden="true">·</span>
                  <span dir="ltr" className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                    {sshKey.fingerprintSha256}
                  </span>
                </div>

                {/* Public Key Copy Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-(--color-text-secondary)">
                      {isFa ? "کلید عمومی (Public Key) جهت ثبت در گیت‌هاب:" : "Public Key for GitHub Deploy Keys:"}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPublicKey}
                      className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border-subtle) bg-(--color-bg-deep) px-2.5 py-1 text-xs font-medium text-(--color-text-primary) transition-colors hover:border-(--color-accent-purple) whitespace-nowrap"
                    >
                      {copiedKey ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{isFa ? "کپی شد" : "Copied"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{isFa ? "کپی کلید" : "Copy Key"}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    readOnly
                    dir="ltr"
                    rows={3}
                    value={sshKey.publicKey}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={isFa ? "کلید عمومی SSH" : "SSH public key"}
                    className="w-full resize-none rounded-lg border border-(--color-border-subtle) bg-[#06060b] p-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-zinc-200 focus:border-(--color-accent-purple) focus:outline-none"
                  />
                </div>

                {/* Step-by-Step GitHub Setup Instructions */}
                <ol className="space-y-1.5 border-t border-(--color-border-subtle) pt-3.5 text-xs leading-relaxed text-(--color-text-secondary)">
                  <li>
                    <strong className="text-(--color-text-primary)">1.</strong>{" "}
                    {isFa
                      ? "در مخزن پرایوت گیت‌هاب به مسیر Settings → Deploy keys بروید."
                      : "Open your private GitHub repo → Settings → Deploy keys."}
                  </li>
                  <li>
                    <strong className="text-(--color-text-primary)">2.</strong>{" "}
                    {isFa
                      ? "روی Add deploy key کلیک کنید و کلید عمومی بالا را وارد کنید (دسترسی Read-only کافی است)."
                      : "Click Add deploy key and paste the public key above (read-only access is sufficient)."}
                  </li>
                  <li>
                    <strong className="text-(--color-text-primary)">3.</strong>{" "}
                    {isFa
                      ? "حالت مخزن را روی «خصوصی (SSH)» بگذارید، آدرس git@github.com را وارد و اتصال را تست کنید."
                      : "Select Private (SSH), enter your git@github.com URL, and click Test & Check Updates."}
                  </li>
                </ol>

                {/* Rotate / Revoke Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--color-border-subtle) pt-3.5">
                  <button
                    type="button"
                    onClick={handleGenerateSshKey}
                    disabled={generatingKey}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs font-medium text-(--color-text-primary) hover:border-(--color-border-strong) disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generatingKey ? "animate-spin" : ""}`} />
                    <span>{isFa ? "بازتولید کلید جدید" : "Rotate SSH Key"}</span>
                  </button>

                  {!confirmRevokeKey ? (
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeKey(true)}
                      disabled={generatingKey}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isFa ? "حذف کلید" : "Revoke"}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeKey(false)}
                        className="h-8 rounded-md px-2 text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                      >
                        {isFa ? "لغو" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSshKey}
                        className="h-8 rounded-md bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-500"
                      >
                        {isFa ? "حذف قطعی" : "Confirm"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <p className="text-xs leading-relaxed text-(--color-text-secondary)">
                  {isFa
                    ? "هنوز کلید SSH برای این سرور ساخته نشده است. با یک کلیک کلید رمزنگاری‌شده Ed25519 بسازید و کلید عمومی آن را در گیت‌هاب ثبت کنید."
                    : "No SSH Deploy Key has been generated yet. Create an Ed25519 keypair in one click and paste the public key into GitHub."}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateSshKey}
                  disabled={generatingKey}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {generatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  <span>{isFa ? "تولید کلید SSH جدید (Ed25519)" : "Generate Ed25519 SSH Key"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Database Engine Health & Quick Maintenance Card */}
          <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-6">
            <div className="flex items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-(--color-text-primary)">
                  {isFa ? "سلامت و بهینه‌سازی دیتابیس" : "Database Health & Indexes"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRunDbOptimize}
                disabled={optimizingDb}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs font-medium text-(--color-text-primary) hover:border-(--color-border-strong) disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${optimizingDb ? "animate-spin" : ""}`} />
                <span>{isFa ? "بهینه‌سازی فوری" : "Optimize Now"}</span>
              </button>
            </div>

            {dbDiag ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div>
                  <dt className="text-(--color-text-tertiary)">{isFa ? "موتور فعال" : "Active Engine"}</dt>
                  <dd className="mt-0.5 font-[family-name:var(--font-mono)] font-semibold uppercase text-(--color-text-primary)">
                    {dbDiag.engine}
                    {dbDiag.sqlite ? ` (${dbDiag.sqlite.journalMode.toUpperCase()})` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-(--color-text-tertiary)">{isFa ? "ایندکس‌های فعال" : "Secondary Indexes"}</dt>
                  <dd className="mt-0.5 font-[family-name:var(--font-mono)] font-semibold tabular-nums text-emerald-400">
                    {dbDiag.sqlite?.indexCount ?? dbDiag.mysql?.indexCount ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-(--color-text-tertiary)">{isFa ? "مجموع رکوردها" : "Total Rows"}</dt>
                  <dd className="mt-0.5 font-[family-name:var(--font-mono)] font-semibold tabular-nums text-(--color-text-primary)">
                    {dbDiag.totalRows.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-(--color-text-tertiary)">{isFa ? "نرخ کش کوئری" : "Stmt Cache Hit Rate"}</dt>
                  <dd className="mt-0.5 font-[family-name:var(--font-mono)] font-semibold tabular-nums text-(--color-text-primary)">
                    {dbDiag.sqlite ? `${dbDiag.sqlite.statementCache.hitRatePct}%` : "Pool Keep-Alive"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-xs text-(--color-text-tertiary)">
                {isFa ? "در حال دریافت آمار دیتابیس…" : "Loading database diagnostics…"}
              </p>
            )}

            {dbDiag?.queryPlanChecks && dbDiag.queryPlanChecks.length > 0 && (
              <div className="mt-4 flex items-center gap-2 border-t border-(--color-border-subtle) pt-3 text-xs text-emerald-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  {isFa
                    ? `${dbDiag.queryPlanChecks.filter((c) => c.usesIndex && !c.hasFullTableScan).length} از ${dbDiag.queryPlanChecks.length} کوئری کلیدی با ایندکس کامل (بدون اسکن جدول)`
                    : `${dbDiag.queryPlanChecks.filter((c) => c.usesIndex && !c.hasFullTableScan).length}/${dbDiag.queryPlanChecks.length} hot queries verified index-backed (0 full scans)`}
                </span>
              </div>
            )}

            {dbMessage && (
              <p className="mt-3 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 text-xs text-(--color-text-secondary)">
                {dbMessage}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom Section: Deployment History Table */}
      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-(--color-text-primary)">
            {isFa ? "تاریخچه بروزرسانی‌ها" : "Recent Deployments"}
          </h2>
          <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {history.length} {isFa ? "مورد" : "runs"}
          </span>
        </div>

        {history.length === 0 ? (
          <p className="py-6 text-center text-xs text-(--color-text-tertiary)">
            {isFa
              ? "هنوز تاریخچه‌ای ثبت نشده است. نخستین بروزرسانی شما اینجا نمایش داده خواهد شد."
              : "No deployment history recorded yet. Your first site update will appear here."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-(--color-border-subtle) text-(--color-text-tertiary)">
                  <th className="py-2.5 text-start font-medium">{isFa ? "وضعیت" : "Status"}</th>
                  <th className="py-2.5 text-start font-medium">{isFa ? "مخزن و شاخه" : "Repository & Branch"}</th>
                  <th className="py-2.5 text-start font-medium">{isFa ? "تغییر نسخه" : "Commit"}</th>
                  <th className="py-2.5 text-start font-medium">{isFa ? "اجراکننده" : "Actor"}</th>
                  <th className="py-2.5 text-end font-medium">{isFa ? "مدت" : "Duration"}</th>
                  <th className="py-2.5 text-end font-medium">{isFa ? "زمان" : "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border-subtle)">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pe-3">
                      <span
                        className={`inline-flex items-center gap-1.5 font-medium ${
                          item.status === "success"
                            ? "text-emerald-400"
                            : item.status === "error"
                              ? "text-red-400"
                              : "text-sky-400"
                        }`}
                      >
                        {item.status === "success" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : item.status === "error" ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        <span>
                          {item.status === "success"
                            ? isFa
                              ? "موفق"
                              : "Success"
                            : item.status === "error"
                              ? isFa
                                ? "خطا"
                                : "Failed"
                              : isFa
                                ? "در حال اجرا"
                                : "Running"}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pe-3 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-primary)">
                      <span dir="ltr">
                        {item.repoUrl.replace(/^https:\/\/github\.com\/|^git@github\.com:/i, "").replace(/\.git$/i, "")}{" "}
                        <span className="text-(--color-text-tertiary)">({item.branch})</span>
                      </span>
                    </td>
                    <td dir="ltr" className="py-2.5 pe-3 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                      {item.fromCommit ?? "init"} → {item.toCommit ?? "—"}
                    </td>
                    <td className="py-2.5 pe-3 text-(--color-text-secondary)">{item.triggeredBy}</td>
                    <td dir="ltr" className="py-2.5 ps-3 text-end font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-secondary)">
                      {formatDurationMs(item.durationMs)}
                    </td>
                    <td className="py-2.5 ps-3 text-end tabular-nums text-(--color-text-tertiary)">
                      {formatTimestampShort(item.startedAt, isFa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
