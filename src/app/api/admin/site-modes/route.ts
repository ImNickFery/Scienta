import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { SITE_MODES_SETTING_KEY, siteModesSchema } from "@/lib/site-modes";
import { getSiteModesWithMeta, saveSiteModes } from "@/lib/site-modes-server";

export async function GET() {
  const { response } = await requireApiAuth("settings.manage");
  if (response) return response;

  const data = await getSiteModesWithMeta();
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const { session, response } = await requireAdminMutation(req, "settings.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = siteModesSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid site modes configuration", parsed.error.flatten());
  }

  const saved = await saveSiteModes(parsed.data);

  await logActivity({
    userId: session!.sub,
    action: "settings.site_modes.update",
    entityType: "settings",
    entityId: SITE_MODES_SETTING_KEY,
    meta: { ...saved },
    ipAddress: getClientIp(req),
  });

  revalidatePath("/", "layout");
  revalidatePath("/fa", "layout");
  revalidatePath("/en", "layout");
  revalidatePath("/admin", "layout");

  return NextResponse.json({
    modes: saved,
    updatedAt: new Date().toISOString(),
  });
}
