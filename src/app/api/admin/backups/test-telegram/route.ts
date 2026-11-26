import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { runTelegramConnectionTest } from "@/lib/backup-service";

const testSchema = z.object({
  sendPingMessage: z.boolean().optional().default(true),
  botToken: z.string().max(256).optional(),
  chatId: z.string().max(128).optional(),
  threadId: z.string().max(32).optional(),
  apiId: z.string().max(32).optional(),
  apiHash: z.string().max(128).optional(),
  apiBaseUrl: z.string().max(256).optional(),
  transportMode: z.enum(["auto", "mtproto", "bot_api"]).optional(),
  clearBotToken: z.boolean().optional(),
  clearApiHash: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdminMutation(req, "backup.manage");
  if (auth.response) return auth.response;

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = testSchema.parse(raw);
    const result = await runTelegramConnectionTest(parsed);
    // Always return HTTP 200 for structured connection diagnostics so the admin UI
    // renders step-by-step Bot API / MTProto / Ping status and network hints cleanly.
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Telegram connection test failed.");
  }
}
