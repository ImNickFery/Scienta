import { isScheduledRunDue } from "./backup-core";
import {
  executeBackupPipeline,
  getHostBackupDiskStatus,
  getResolvedBackupSettings,
  isBackupCurrentlyRunning,
  manualPurgeBackupStaging,
} from "./backup-service";

declare global {
  var __scientaBackupSchedulerStarted: boolean | undefined;
  var __scientaBackupSchedulerTimer: ReturnType<typeof setInterval> | undefined;
}

const POLL_INTERVAL_MS = 60_000;

async function tickScheduledBackup(): Promise<void> {
  if (isBackupCurrentlyRunning()) return;
  try {
    const settings = await getResolvedBackupSettings();
    const due = isScheduledRunDue({
      enabled: settings.enabled,
      scheduleUtcHour: settings.scheduleUtcHour,
      scheduleUtcMinute: settings.scheduleUtcMinute,
      lastScheduledUtcDate: settings.lastScheduledUtcDate,
      now: new Date(),
    });
    if (!due) return;

    // Require live Telegram credentials before firing an automated scheduled run
    if (!settings.effectiveBotToken || !settings.effectiveChatId) {
      return;
    }

    await executeBackupPipeline({ trigger: "scheduled", actorUserId: null });
  } catch (err) {
    console.error("[backup-scheduler] Scheduled UTC backup tick failed:", err);
  }
}

/**
 * Starts the built-in 00:00 UTC backup scheduler once per Node.js process and
 * immediately sweeps any orphaned backup temp files left behind by a prior crash.
 */
export function startBackupScheduler(): void {
  if (globalThis.__scientaBackupSchedulerStarted) return;
  globalThis.__scientaBackupSchedulerStarted = true;

  // Sweep any leftover files from an interrupted run on boot
  const disk = getHostBackupDiskStatus();
  if (!disk.clean) {
    void manualPurgeBackupStaging(3, null).catch((err) => {
      console.error("[backup-scheduler] Startup orphan cleanup failed:", err);
    });
  }

  const timer = setInterval(() => {
    void tickScheduledBackup();
  }, POLL_INTERVAL_MS);

  // Do not prevent graceful process exit
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  globalThis.__scientaBackupSchedulerTimer = timer;
}
