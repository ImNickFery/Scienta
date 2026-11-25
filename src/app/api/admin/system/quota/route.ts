import { NextResponse } from "next/server";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { getAccountQuotaConfig, saveAccountQuotaConfig } from "@/lib/account-quota";
import { invalidateTelemetryCoalesceCache } from "@/lib/system-telemetry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { response } = await requireApiAuth("settings.manage");
  if (response) return response;

  const config = await getAccountQuotaConfig();
  return NextResponse.json({ config }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const { session, response } = await requireAdminMutation(req, "settings.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("Invalid JSON payload");
  }

  const saved = await saveAccountQuotaConfig(body);
  if (!saved.ok) {
    return badRequest(saved.error);
  }

  invalidateTelemetryCoalesceCache();

  await logActivity({
    userId: session!.sub,
    action: "system.quota.config.save",
    entityType: "system",
    entityId: "host_account_quota",
    meta: {
      planLabel: saved.config.planLabel,
      diskLimitMb: saved.config.diskLimitMb,
      ramLimitMb: saved.config.ramLimitMb,
      cpuCores: saved.config.cpuCores,
      inodeLimit: saved.config.inodeLimit,
      entryProcessLimit: saved.config.entryProcessLimit,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(
    { config: saved.config },
    { headers: { "Cache-Control": "no-store" } }
  );
}
