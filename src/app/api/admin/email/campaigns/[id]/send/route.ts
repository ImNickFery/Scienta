import { NextResponse } from "next/server";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { dispatchCampaign } from "@/lib/email-service";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  const { id } = await context.params;
  try {
    const result = await dispatchCampaign(id, session!.sub);

    await logActivity({
      userId: session!.sub,
      action: "email.campaign.send",
      entityType: "email_campaign",
      entityId: id,
      meta: result,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Campaign dispatch failed");
  }
}
