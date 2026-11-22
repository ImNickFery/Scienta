import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import {
  deleteSshDeployKey,
  generateOrRotateSshDeployKey,
  getSshKeyStatus,
} from "@/lib/system-updater";

export const dynamic = "force-dynamic";

const createKeySchema = z.object({
  comment: z.string().trim().min(1).max(64).optional(),
});

export async function GET() {
  const { response } = await requireApiAuth("settings.manage");
  if (response) return response;

  const status = await getSshKeyStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "settings.manage");
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const parsed = createKeySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return badRequest("Invalid SSH key options", parsed.error.flatten());
  }

  const status = await generateOrRotateSshDeployKey(parsed.data.comment ?? "scienta-panel-deploy");

  await logActivity({
    userId: session!.sub,
    action: "system.ssh_key.generate",
    entityType: "system",
    entityId: status.fingerprintSha256 ?? "ed25519",
    meta: {
      algorithm: status.algorithm,
      fingerprintSha256: status.fingerprintSha256,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(req: Request) {
  const { session, response } = await requireAdminMutation(req, "settings.manage");
  if (response) return response;

  const status = await deleteSshDeployKey();

  await logActivity({
    userId: session!.sub,
    action: "system.ssh_key.delete",
    entityType: "system",
    entityId: "ed25519",
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
