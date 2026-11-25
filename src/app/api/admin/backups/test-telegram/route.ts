import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { runTelegramConnectionTest } from "@/lib/backup-service";

const testSchema = z.object({
  sendPingMessage: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const auth = await requireAdminMutation(req, "backup.manage");
  if (auth.response) return auth.response;

  try {
    const raw = await req.json().catch(() => ({}));
    const { sendPingMessage } = testSchema.parse(raw);
    const result = await runTelegramConnectionTest(sendPingMessage);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Telegram connection test failed.");
  }
}
