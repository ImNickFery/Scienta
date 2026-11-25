import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { timingSafeEqualSecret } from "@/lib/backup-core";
import {
  executeBackupPipeline,
  getHostBackupDiskStatus,
  getResolvedBackupSettings,
  isBackupCurrentlyRunning,
} from "@/lib/backup-service";

/**
 * External UTC Cron trigger endpoint for cPanel / systemd / GitHub Actions:
 *   0 0 * * * curl -fsS -X POST -H "Authorization: Bearer <SECRET>" https://yourdomain.com/api/cron/backup
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`cron:backup:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const settings = await getResolvedBackupSettings();
  const expectedSecret = settings.effectiveCronSecret;
  if (!expectedSecret || expectedSecret.length < 16) {
    return NextResponse.json(
      { error: "Backup cron secret is not configured." },
      { status: 401 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerToken = req.headers.get("x-backup-cron-secret")?.trim() || "";
  const provided = bearerToken || headerToken;

  if (!timingSafeEqualSecret(expectedSecret, provided)) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  if (!settings.enabled) {
    return NextResponse.json({ skipped: true, reason: "Scheduled backups are disabled." });
  }

  if (isBackupCurrentlyRunning()) {
    return NextResponse.json(
      { error: "A backup job is already running." },
      { status: 409 }
    );
  }

  try {
    const run = await executeBackupPipeline({
      trigger: "cron",
      dryRun: false,
      actorUserId: null,
    });
    const disk = getHostBackupDiskStatus();
    return NextResponse.json({
      ok: run.status === "success",
      runId: run.id,
      status: run.status,
      dbFile: run.dbFileName,
      dbSizeBytes: run.dbSizeBytes,
      fullFile: run.fullFileName,
      fullSizeBytes: run.fullSizeBytes,
      cleanupVerified: run.cleanupVerified,
      cleanupPasses: run.cleanupPasses,
      hostDiskClean: disk.clean,
      error: run.errorMessage,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron backup failed." },
      { status: 500 }
    );
  }
}
