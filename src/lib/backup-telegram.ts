import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  redactBackupSecrets,
  selectTelegramTransport,
  type TelegramTransportPreference,
} from "./backup-core";

export interface TelegramCredentials {
  botToken: string;
  chatId: string;
  threadId?: string;
  apiId?: string;
  apiHash?: string;
  transportMode: TelegramTransportPreference;
}

export interface TelegramUploadResult {
  transport: "mtproto" | "bot_api";
  messageId: string | null;
}

export interface TelegramConnectionTestResult {
  ok: boolean;
  botUsername: string | null;
  botFirstName: string | null;
  botApiOk: boolean;
  mtprotoTested: boolean;
  mtprotoOk: boolean;
  messageSent: boolean;
  messageId: string | null;
  warnings: string[];
  error?: string;
}

const TELEGRAM_BOT_API_BASE = "https://api.telegram.org";

function parseChatTarget(rawChatId: string): string | number {
  const trimmed = rawChatId.trim();
  if (/^-?\d+$/.test(trimmed)) {
    const asNum = Number(trimmed);
    if (Number.isSafeInteger(asNum)) return asNum;
  }
  return trimmed;
}

function parseThreadId(rawThreadId?: string): number | undefined {
  if (!rawThreadId || !/^\d+$/.test(rawThreadId.trim())) return undefined;
  const num = Number(rawThreadId.trim());
  return Number.isSafeInteger(num) && num > 0 ? num : undefined;
}

async function callBotApiJson<T>(
  botToken: string,
  method: string,
  body?: Record<string, unknown> | FormData,
  timeoutMs = 120_000
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const isForm = body instanceof FormData;
    const res = await fetch(`${TELEGRAM_BOT_API_BASE}/bot${botToken}/${method}`, {
      method: body ? "POST" : "GET",
      headers: isForm ? undefined : body ? { "Content-Type": "application/json" } : undefined,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    return {
      ok: Boolean(res.ok && json.ok),
      result: json.result,
      description: json.description
        ? redactBackupSecrets(json.description)
        : res.ok
          ? undefined
          : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      description: redactBackupSecrets(
        err instanceof Error ? err.message : "Telegram API network error"
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function sendDocumentViaBotApi(params: {
  creds: TelegramCredentials;
  filePath: string;
  fileName: string;
  caption: string;
}): Promise<TelegramUploadResult> {
  const fileBuffer = await fs.promises.readFile(params.filePath);
  const blob = new Blob([fileBuffer], { type: "application/gzip" });
  const form = new FormData();
  form.append("chat_id", params.creds.chatId.trim());
  form.append("document", blob, params.fileName);
  form.append("caption", params.caption.slice(0, 1024));
  const threadId = parseThreadId(params.creds.threadId);
  if (threadId) {
    form.append("message_thread_id", String(threadId));
  }

  const resp = await callBotApiJson<{ message_id?: number }>(
    params.creds.botToken,
    "sendDocument",
    form,
    300_000
  );

  if (!resp.ok) {
    throw new Error(
      `Telegram Bot API sendDocument failed: ${resp.description ?? "Unknown error"}`
    );
  }

  return {
    transport: "bot_api",
    messageId: resp.result?.message_id != null ? String(resp.result.message_id) : null,
  };
}

async function withMtprotoClient<T>(
  apiId: number,
  apiHash: string,
  botToken: string,
  fn: (client: import("telegram").TelegramClient) => Promise<T>
): Promise<T> {
  const nodeRequire = createRequire(import.meta.url);
  const tg = nodeRequire("telegram") as typeof import("telegram");
  const { TelegramClient, Logger, sessions } = tg;
  const { StringSession } = sessions;

  const logger = new Logger("error" as never);
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 4,
    retryDelay: 1500,
    autoReconnect: true,
    baseLogger: logger,
  });

  try {
    await client.start({ botAuthToken: botToken });
    return await fn(client);
  } finally {
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors on teardown
    }
    try {
      await client.destroy();
    } catch {
      // Ignore destroy errors
    }
  }
}

async function sendDocumentViaMtproto(params: {
  creds: TelegramCredentials;
  filePath: string;
  fileName: string;
  caption: string;
}): Promise<TelegramUploadResult> {
  const apiId = Number(params.creds.apiId?.trim());
  const apiHash = params.creds.apiHash?.trim() ?? "";
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
    throw new Error("MTProto upload requires valid numeric api_id and api_hash.");
  }

  const target = parseChatTarget(params.creds.chatId);
  const threadId = parseThreadId(params.creds.threadId);

  try {
    return await withMtprotoClient(apiId, apiHash, params.creds.botToken, async (client) => {
      const entity = await client.getInputEntity(target);
      const sent = await client.sendFile(entity, {
        file: params.filePath,
        caption: params.caption.slice(0, 1024),
        forceDocument: true,
        workers: 4,
        ...(threadId ? { replyTo: threadId } : {}),
      });
      const messageId =
        sent && typeof sent === "object" && "id" in sent && sent.id != null
          ? String((sent as { id: unknown }).id)
          : null;
      return {
        transport: "mtproto",
        messageId,
      };
    });
  } catch (err) {
    const clean = redactBackupSecrets(
      err instanceof Error ? err.message : "Telegram MTProto upload failed"
    );
    if (clean.includes("Could not find the input entity")) {
      throw new Error(
        `Telegram MTProto could not resolve target chat (${params.creds.chatId}). Ensure the bot is added to the chat/channel as admin or use @channel_username.`
      );
    }
    throw new Error(`Telegram MTProto upload failed: ${clean}`);
  }
}

/**
 * Uploads a single backup archive to Telegram using MTProto (up to 2 GB via api_id + api_hash)
 * or standard Bot API (up to 50 MB), based on configured transport preferences and file size.
 */
export async function uploadBackupFileToTelegram(params: {
  creds: TelegramCredentials;
  filePath: string;
  fileName?: string;
  caption: string;
}): Promise<TelegramUploadResult> {
  const stat = await fs.promises.stat(params.filePath);
  const fileName = params.fileName || path.basename(params.filePath);

  const selection = selectTelegramTransport({
    preference: params.creds.transportMode,
    fileSizeBytes: stat.size,
    hasBotToken: Boolean(params.creds.botToken.trim()),
    hasApiId: Boolean(params.creds.apiId?.trim()),
    hasApiHash: Boolean(params.creds.apiHash?.trim()),
  });

  if (!selection.ok || !selection.transport) {
    throw new Error(selection.error || "Unable to select a valid Telegram upload transport.");
  }

  if (selection.transport === "mtproto") {
    return sendDocumentViaMtproto({
      creds: params.creds,
      filePath: params.filePath,
      fileName,
      caption: params.caption,
    });
  }

  return sendDocumentViaBotApi({
    creds: params.creds,
    filePath: params.filePath,
    fileName,
    caption: params.caption,
  });
}

/** Sends a concise status/cleanup text notice to the configured Telegram backup chat. */
export async function sendTelegramStatusMessage(
  creds: TelegramCredentials,
  text: string
): Promise<{ ok: boolean; messageId: string | null; error?: string }> {
  if (!creds.botToken.trim() || !creds.chatId.trim()) {
    return { ok: false, messageId: null, error: "Bot Token or Chat ID is missing." };
  }
  const threadId = parseThreadId(creds.threadId);
  const payload: Record<string, unknown> = {
    chat_id: creds.chatId.trim(),
    text: text.slice(0, 4096),
    disable_web_page_preview: true,
  };
  if (threadId) {
    payload.message_thread_id = threadId;
  }

  const resp = await callBotApiJson<{ message_id?: number }>(
    creds.botToken.trim(),
    "sendMessage",
    payload,
    30_000
  );

  return {
    ok: resp.ok,
    messageId: resp.result?.message_id != null ? String(resp.result.message_id) : null,
    error: resp.description,
  };
}

/**
 * Tests Telegram Bot API credentials, optionally verifies MTProto handshake with
 * api_id + api_hash (large-file mode), and optionally sends a ping message to chatId.
 */
export async function testTelegramConnection(
  creds: TelegramCredentials,
  sendPingMessage: boolean
): Promise<TelegramConnectionTestResult> {
  const warnings: string[] = [];
  if (!creds.botToken.trim()) {
    return {
      ok: false,
      botUsername: null,
      botFirstName: null,
      botApiOk: false,
      mtprotoTested: false,
      mtprotoOk: false,
      messageSent: false,
      messageId: null,
      warnings,
      error: "Telegram Bot Token is required.",
    };
  }

  // 1. Verify Bot Token via Bot API getMe
  const me = await callBotApiJson<{ id?: number; username?: string; first_name?: string }>(
    creds.botToken.trim(),
    "getMe",
    undefined,
    20_000
  );

  if (!me.ok) {
    return {
      ok: false,
      botUsername: null,
      botFirstName: null,
      botApiOk: false,
      mtprotoTested: false,
      mtprotoOk: false,
      messageSent: false,
      messageId: null,
      warnings,
      error: `Bot Token verification failed: ${me.description ?? "Invalid token"}`,
    };
  }

  const botUsername = me.result?.username ?? null;
  const botFirstName = me.result?.first_name ?? null;

  // 2. Verify MTProto handshake if api_id + api_hash are configured
  let mtprotoTested = false;
  let mtprotoOk = false;
  const hasApiId = Boolean(creds.apiId?.trim());
  const hasApiHash = Boolean(creds.apiHash?.trim());

  if (hasApiId && hasApiHash) {
    mtprotoTested = true;
    const numericApiId = Number(creds.apiId?.trim());
    if (!Number.isInteger(numericApiId) || numericApiId <= 0) {
      warnings.push("Telegram api_id must be a positive integer.");
    } else {
      try {
        await withMtprotoClient(
          numericApiId,
          creds.apiHash!.trim(),
          creds.botToken.trim(),
          async (client) => {
            await client.getMe();
          }
        );
        mtprotoOk = true;
      } catch (err) {
        const clean = redactBackupSecrets(
          err instanceof Error ? err.message : "MTProto handshake failed"
        );
        warnings.push(`MTProto handshake failed: ${clean}`);
      }
    }
  } else if (hasApiId || hasApiHash) {
    warnings.push("Provide both api_id and api_hash to enable 2 GB MTProto uploads.");
  } else {
    warnings.push("MTProto api_id / api_hash not set — uploads are limited to 50 MB Bot API.");
  }

  // 3. Optionally send a test ping to Chat ID
  let messageSent = false;
  let messageId: string | null = null;
  let sendError: string | undefined;

  if (sendPingMessage) {
    if (!creds.chatId.trim()) {
      sendError = "Target Chat / Channel ID is required to send a test message.";
    } else {
      const modeLabel = mtprotoOk
        ? "MTProto (up to 2 GB)"
        : "Bot API (up to 50 MB)";
      const pingText = [
        "Scienta Automated Backup — Connection Verified",
        `Bot: @${botUsername ?? "scienta_bot"}`,
        `Transport: ${modeLabel}`,
        `UTC Time: ${new Date().toISOString()}`,
      ].join("\n");
      const sent = await sendTelegramStatusMessage(creds, pingText);
      messageSent = sent.ok;
      messageId = sent.messageId;
      if (!sent.ok) {
        sendError = sent.error ?? "Failed to send test message to chat.";
      }
    }
  }

  const overallOk =
    me.ok &&
    (!sendPingMessage || messageSent) &&
    (creds.transportMode !== "mtproto" || mtprotoOk);

  return {
    ok: overallOk,
    botUsername,
    botFirstName,
    botApiOk: true,
    mtprotoTested,
    mtprotoOk,
    messageSent,
    messageId,
    warnings,
    error: sendError,
  };
}
