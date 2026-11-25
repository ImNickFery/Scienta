import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/session";
import {
  getActiveBackupRunId,
  getHostBackupDiskStatus,
  getPublicBackupSettings,
  isBackupCurrentlyRunning,
  listBackupRuns,
} from "@/lib/backup-service";
import { getActiveDbEngine } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await requireApiAuth("backup.manage");
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, Math.floor(limitParam))) : 30;

  const [settings, runs] = await Promise.all([
    getPublicBackupSettings(),
    listBackupRuns(limit),
  ]);
  const disk = getHostBackupDiskStatus();

  return NextResponse.json({
    settings,
    runs,
    disk,
    dbEngine: getActiveDbEngine(),
    running: isBackupCurrentlyRunning(),
    activeRunId: getActiveBackupRunId(),
    serverUtcNow: new Date().toISOString(),
  });
}
