import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminMutation, requireApiAuth, badRequest } from "@/lib/session";
import {
  getHostBackupDiskStatus,
  getPublicBackupSettings,
  isBackupCurrentlyRunning,
  rotateBackupCronSecret,
  updateBackupSettings,
} from "@/lib/backup-service";
import { getActiveDbEngine } from "@/lib/db";

export async function GET() {
  const auth = await requireApiAuth("backup.manage");
  if (auth.response) return auth.response;

  const settings = await getPublicBackupSettings();
  const disk = getHostBackupDiskStatus();

  return NextResponse.json({
    settings,
    disk,
    dbEngine: getActiveDbEngine(),
    running: isBackupCurrentlyRunning(),
    serverUtcNow: new Date().toISOString(),
  });
}

export async function PUT(req: Request) {
  const auth = await requireAdminMutation(req, "backup.manage");
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const settings = await updateBackupSettings(body, auth.session.sub);
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof ZodError) {
      const firstIssues = err.issues
        .map((issue) => {
          const field = issue.path.join(".");
          return field ? `${field}: ${issue.message}` : issue.message;
        })
        .slice(0, 3)
        .join(" · ");
      return badRequest(firstIssues || "Invalid backup settings.", err.flatten());
    }
    return badRequest(err instanceof Error ? err.message : "Failed to save backup settings.");
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminMutation(req, "backup.manage");
  if (auth.response) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action === "rotate_cron_secret") {
      const result = await rotateBackupCronSecret(auth.session.sub);
      return NextResponse.json(result);
    }
    return badRequest("Unsupported settings action.");
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Failed to rotate cron secret.");
  }
}
