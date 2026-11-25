import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminMutation, badRequest } from "@/lib/session";
import {
  executeBackupPipeline,
  getHostBackupDiskStatus,
  isBackupCurrentlyRunning,
} from "@/lib/backup-service";

const runSchema = z.object({
  dryRun: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const auth = await requireAdminMutation(req, "backup.manage");
  if (auth.response) return auth.response;

  if (isBackupCurrentlyRunning()) {
    return NextResponse.json(
      { error: "A backup job is already in progress. Please wait for it to finish." },
      { status: 409 }
    );
  }

  let dryRun = false;
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = runSchema.parse(raw);
    dryRun = parsed.dryRun;
  } catch {
    return badRequest("Invalid backup run options.");
  }

  try {
    const run = await executeBackupPipeline({
      trigger: dryRun ? "dry_run" : "manual",
      dryRun,
      actorUserId: auth.session.sub,
    });
    const disk = getHostBackupDiskStatus();
    return NextResponse.json({ run, disk });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup execution failed." },
      { status: 500 }
    );
  }
}
