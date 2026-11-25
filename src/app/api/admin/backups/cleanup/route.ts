import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminMutation } from "@/lib/session";
import { manualPurgeBackupStaging } from "@/lib/backup-service";

const cleanupSchema = z.object({
  passes: z.coerce.number().int().min(2).max(5).optional().default(3),
});

export async function POST(req: Request) {
  const auth = await requireAdminMutation(req, "backup.manage");
  if (auth.response) return auth.response;

  try {
    const raw = await req.json().catch(() => ({}));
    const { passes } = cleanupSchema.parse(raw);
    const result = await manualPurgeBackupStaging(passes, auth.session.sub);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Host disk cleanup check failed." },
      { status: 409 }
    );
  }
}
