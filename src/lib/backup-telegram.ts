import crypto from "node:crypto";
import dns from "node:dns";
import fs from "node:fs";
import https from "node:https";
import { createRequire } from "node:module";
import path from "node:path";
import {
  BOT_API_MAX_BYTES,
  isPrivateOrReservedIp,
  normalizeTelegramApiId,
  normalizeTelegramBotToken,
  normalizeTelegramChatId,
  normalizeTelegramThreadId,
  redactBackupSecrets,
  selectTelegramTransport,
  validateTelegramApiBaseUrl,
  type TelegramTransportPreference,
} from "./backup-core";

export interface TelegramCredentials {
  botToken: string;
  chatId: string;
  threadId?: string;
  apiId?: string;
  apiHash?: string;
  apiBaseUrl?: string;
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
  endpointUsed?: string;
  networkHint?: string;
  warnings: string[];
  error?: string;
}

const DEFAULT_TELEGRAM_BOT_API_BASE = "https://api.telegram.org";

function normalizeCredentials(creds: TelegramCredentials): TelegramCredentials {
  return {
    botToken: normalizeTelegramBotToken(creds.botToken || ""),
    chatId: normalizeTelegramChatId(creds.chatId || ""),
    threadId: normalizeTelegramThreadId(creds.threadId || ""),
    apiId: normalizeTelegramApiId(creds.apiId || ""),
    apiHash: (creds.apiHash || "").trim(),
    apiBaseUrl: (creds.apiBaseUrl || "").trim(),
    transportMode: creds.transportMode,
  };
}

function parseChatTarget(rawChatId: string): string | number {
  const trimmed = normalizeTelegramChatId(rawChatId);
  if (/^-?\d+$/.test(trimmed)) {
    const asNum = Number(trimmed);
    if (Number.isSafeInteger(asNum)) return asNum;
  }
  return trimmed;
}

function parseThreadId(rawThreadId?: string): number | undefined {
  const normalized = normalizeTelegramThreadId(rawThreadId || "");
  if (!normalized || !/^\d+$/.test(normalized)) return undefined;
  const num = Number(normalized);
  return Number.isSafeInteger(num) && num > 0 ? num : undefined;
}

/**
 * Validates and DNS-checks the Bot API base URL so custom reverse proxies
 * cannot resolve to private, loopback, or cloud-metadata IP ranges.
 */
async function resolveSafeBotApiBase(
  rawApiBaseUrl?: string
): Promise<{ ok: true; baseUrl: string; isCustom: boolean } | { ok: false; error: string }> {
  const checked = validateTelegramApiBaseUrl(rawApiBaseUrl || "");
  if (!checked.ok) {
    return { ok: false, error: checked.error };
  }
  if (!checked.normalized) {
    return { ok: true, baseUrl: DEFAULT_TELEGRAM_BOT_API_BASE, isCustom: false };
  }

  // Verify DNS resolution of the custom domain does not point to any private/internal IP
  try {
    const parsed = new URL(checked.normalized);
    const records = await dns.promises.lookup(parsed.hostname, { all: true });
    if (!records || records.length === 0) {
      return {
        ok: false,
        error: `Could not resolve DNS for custom Telegram API host (${parsed.hostname}).`,
      };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return {
          ok: false,
          error: "Custom Telegram API host resolves to a restricted internal IP address.",
        };
      }
    }
  } catch (err) {
    const code = extractErrorCauseCode(err);
    return {
      ok: false,
      error: `DNS lookup failed for custom Telegram API URL${code ? ` (${code})` : ""}.`,
    };
  }

  return { ok: true, baseUrl: checked.normalized, isCustom: true };
}

function extractErrorCauseCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const record = err as {
    code?: unknown;
    name?: unknown;
    cause?: unknown;
    errors?: unknown[];
  };
  if (typeof record.code === "string" && record.code) return record.code;
  if (record.name === "AbortError" || record.name === "TimeoutError") return "ETIMEDOUT";
  if (record.cause && typeof record.cause === "object") {
    const fromCause = extractErrorCauseCode(record.cause);
    if (fromCause) return fromCause;
  }
  if (Array.isArray(record.errors)) {
    for (const sub of record.errors) {
      const fromSub = extractErrorCauseCode(sub);
      if (fromSub) return fromSub;
    }
  }
  return undefined;
}

function diagnoseTelegramFailure(params: {
  status?: number;
  description?: string;
  errorCode?: string;
  isCustomEndpoint: boolean;
  step: "getMe" | "sendMessage" | "sendDocument";
}): string | undefined {
  const desc = (params.description || "").toLowerCase();
  const code = (params.errorCode || "").toUpperCase();

  // Redirect blocked on custom proxy
  if (params.status && params.status >= 300 && params.status < 400) {
    return "Custom Telegram API URL returned an HTTP redirect. Use a transparent HTTPS reverse proxy (e.g. Cloudflare Worker) that forwards /bot<token>/<method> directly without redirects.";
  }

  // Network / firewall / filtering failures
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_SOCKET" ||
    desc.includes("fetch failed") ||
    desc.includes("aborted") ||
    desc.includes("timed out")
  ) {
    if (!params.isCustomEndpoint) {
      return "Your hosting server could not reach api.telegram.org directly (common on Iranian or firewall-restricted shared hosts). Enter a custom HTTPS reverse-proxy URL (such as a Cloudflare Worker) in the 'Custom Telegram Bot API URL' field and test again.";
    }
    return "Your hosting server could not reach the custom Telegram API proxy URL. Verify the worker/proxy domain is online, uses valid HTTPS, and is accessible from your host.";
  }

  if (code === "ENOTFOUND") {
    return params.isCustomEndpoint
      ? "Custom Telegram API domain could not be resolved by DNS. Check the URL spelling."
      : "Server DNS could not resolve api.telegram.org. Check your host's DNS or set a custom HTTPS proxy URL.";
  }

  if (params.status === 401 || desc.includes("unauthorized")) {
    return "Telegram rejected the Bot Token (401 Unauthorized). Copy the exact token from @BotFather without extra spaces or a leading 'bot' prefix.";
  }

  if (params.status === 404 && params.step === "getMe") {
    return params.isCustomEndpoint
      ? "Endpoint returned 404 Not Found. Verify both the Bot Token and that your custom proxy forwards paths like /bot<TOKEN>/getMe to https://api.telegram.org."
      : "Telegram returned 404 Not Found. Check that your Bot Token matches the format 123456789:AAH... from @BotFather.";
  }

  if (
    desc.includes("chat not found") ||
    desc.includes("peer_id_invalid") ||
    desc.includes("chat_id is empty")
  ) {
    return "Telegram could not find the target Chat / Channel ID. For private channels/supergroups use the -100... numeric ID and add the bot as an Admin; for direct user chats open the bot and press /start first.";
  }

  if (
    params.status === 403 ||
    desc.includes("forbidden") ||
    desc.includes("not enough rights") ||
    desc.includes("need administrator rights") ||
    desc.includes("bot was kicked") ||
    desc.includes("bot was blocked")
  ) {
    return "The bot does not have permission to post in this chat/channel. Promote the bot to Administrator with 'Post Messages' enabled (or unblock it and send /start).";
  }

  if (desc.includes("message thread not found")) {
    return "The specified Forum Topic / Thread ID was not found in this group. Leave Thread ID empty for normal channels or groups.";
  }

  return undefined;
}

/**
 * IPv4-forced HTTPS request helper (prevents Node 18-22 undici IPv6 hang on shared hosts
 * where api.telegram.org advertises an AAAA record but the host lacks outbound IPv6 routing).
 */
async function httpsIpv4Request(params: {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  bodyBuffer?: Buffer;
  timeoutMs: number;
}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(params.url);
    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: params.method,
        family: 4,
        headers: {
          ...(params.headers ?? {}),
          ...(params.bodyBuffer
            ? { "Content-Length": String(params.bodyBuffer.length) }
            : {}),
        },
        timeout: params.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("timeout", () => {
      const timeoutErr = new Error("Request timed out");
      (timeoutErr as Error & { code?: string }).code = "ETIMEDOUT";
      req.destroy(timeoutErr);
    });
    req.on("error", reject);

    if (params.bodyBuffer) {
      req.write(params.bodyBuffer);
    }
    req.end();
  });
}

function buildMultipartBuffer(params: {
  fields: Record<string, string>;
  fileField: string;
  fileName: string;
  contentType: string;
  fileBuffer: Buffer;
}): { boundary: string; body: Buffer } {
  const boundary = `----ScientaBackup${crypto.randomBytes(12).toString("hex")}`;
  const parts: Buffer[] = [];

  for (const [key, val] of Object.entries(params.fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`,
        "utf8"
      )
    );
  }

  const safeFileName = params.fileName.replace(/["\r\n]/g, "_");
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${params.fileField}"; filename="${safeFileName}"\r\nContent-Type: ${params.contentType}\r\n\r\n`,
      "utf8"
    )
  );
  parts.push(params.fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"));

  return { boundary, body: Buffer.concat(parts) };
}

interface BotApiCallResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
  status?: number;
  errorCode?: string;
  endpointUsed: string;
  networkHint?: string;
}

async function callBotApiJson<T>(params: {
  botToken: string;
  apiBaseUrl?: string;
  method: "getMe" | "sendMessage" | "sendDocument";
  jsonBody?: Record<string, unknown>;
  multipart?: {
    fields: Record<string, string>;
    fileField: string;
    fileName: string;
    contentType: string;
    fileBuffer: Buffer;
  };
  timeoutMs?: number;
}): Promise<BotApiCallResult<T>> {
  const token = normalizeTelegramBotToken(params.botToken);
  const timeoutMs = params.timeoutMs ?? 120_000;

  const baseCheck = await resolveSafeBotApiBase(params.apiBaseUrl);
  if (!baseCheck.ok) {
    return {
      ok: false,
      description: baseCheck.error,
      endpointUsed: params.apiBaseUrl?.trim() || DEFAULT_TELEGRAM_BOT_API_BASE,
      networkHint: baseCheck.error,
    };
  }

  const endpointUsed = baseCheck.baseUrl;
  const fullUrl = `${baseCheck.baseUrl}/bot${token}/${params.method}`;

  let httpMethod: "GET" | "POST" = "GET";
  let headers: Record<string, string> | undefined;
  let bodyBuffer: Buffer | undefined;

  if (params.multipart) {
    httpMethod = "POST";
    const built = buildMultipartBuffer(params.multipart);
    headers = { "Content-Type": `multipart/form-data; boundary=${built.boundary}` };
    bodyBuffer = built.body;
  } else if (params.jsonBody) {
    httpMethod = "POST";
    headers = { "Content-Type": "application/json" };
    bodyBuffer = Buffer.from(JSON.stringify(params.jsonBody), "utf8");
  }

  // Primary attempt: IPv4-first Node HTTPS (immune to broken IPv6 routes on shared hosts
  // and enforces redirect-free connections directly to the verified HTTPS endpoint).
  try {
    const res = await httpsIpv4Request({
      url: fullUrl,
      method: httpMethod,
      headers,
      bodyBuffer,
      timeoutMs,
    });

    if (res.status >= 300 && res.status < 400) {
      const description = `HTTP ${res.status} redirect blocked`;
      return {
        ok: false,
        status: res.status,
        description,
        endpointUsed,
        networkHint: diagnoseTelegramFailure({
          status: res.status,
          description,
          isCustomEndpoint: baseCheck.isCustom,
          step: params.method,
        }),
      };
    }

    let parsedJson: { ok?: boolean; result?: T; description?: string } = {};
    try {
      parsedJson = JSON.parse(res.text) as { ok?: boolean; result?: T; description?: string };
    } catch {
      parsedJson = {};
    }

    const ok = res.status >= 200 && res.status < 300 && Boolean(parsedJson.ok);
    const description = parsedJson.description
      ? redactBackupSecrets(parsedJson.description)
      : ok
        ? undefined
        : `HTTP ${res.status || 0}`;

    return {
      ok,
      result: parsedJson.result,
      status: res.status,
      description,
      endpointUsed,
      networkHint: ok
        ? undefined
        : diagnoseTelegramFailure({
            status: res.status,
            description,
            isCustomEndpoint: baseCheck.isCustom,
            step: params.method,
          }),
    };
  } catch (ipv4Err) {
    // Fallback to standard fetch (handles IPv6-only networks if IPv4 route is unavailable)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 20_000));
    try {
      const res = await fetch(fullUrl, {
        method: httpMethod,
        headers,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
        redirect: "manual",
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const description = `HTTP ${res.status} redirect blocked`;
        return {
          ok: false,
          status: res.status,
          description,
          endpointUsed,
          networkHint: diagnoseTelegramFailure({
            status: res.status,
            description,
            isCustomEndpoint: baseCheck.isCustom,
            step: params.method,
          }),
        };
      }

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: T;
        description?: string;
      };
      const ok = Boolean(res.ok && json.ok);
      const description = json.description
        ? redactBackupSecrets(json.description)
        : ok
          ? undefined
          : `HTTP ${res.status}`;

      return {
        ok,
        result: json.result,
        status: res.status,
        description,
        endpointUsed,
        networkHint: ok
          ? undefined
          : diagnoseTelegramFailure({
              status: res.status,
              description,
              isCustomEndpoint: baseCheck.isCustom,
              step: params.method,
            }),
      };
    } catch (fetchErr) {
      const code = extractErrorCauseCode(ipv4Err) || extractErrorCauseCode(fetchErr);
      const rawMessage =
        ipv4Err instanceof Error
          ? ipv4Err.message
          : fetchErr instanceof Error
            ? fetchErr.message
            : "Telegram API network error";
      const description = redactBackupSecrets(
        code && !rawMessage.includes(code) ? `${rawMessage} (${code})` : rawMessage
      );
      return {
        ok: false,
        errorCode: code,
        description,
        endpointUsed,
        networkHint: diagnoseTelegramFailure({
          description,
          errorCode: code,
          isCustomEndpoint: baseCheck.isCustom,
          step: params.method,
        }),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

async function sendDocumentViaBotApi(params: {
  creds: TelegramCredentials;
  filePath: string;
  fileName: string;
  caption: string;
}): Promise<TelegramUploadResult> {
  const fileBuffer = await fs.promises.readFile(params.filePath);
  const fields: Record<string, string> = {
    chat_id: params.creds.chatId,
    caption: params.caption.slice(0, 1024),
  };
  const threadId = parseThreadId(params.creds.threadId);
  if (threadId) {
    fields.message_thread_id = String(threadId);
  }

  const resp = await callBotApiJson<{ message_id?: number }>({
    botToken: params.creds.botToken,
    apiBaseUrl: params.creds.apiBaseUrl,
    method: "sendDocument",
    multipart: {
      fields,
      fileField: "document",
      fileName: params.fileName,
      contentType: "application/gzip",
      fileBuffer,
    },
    timeoutMs: 300_000,
  });

  if (!resp.ok) {
    const hintSuffix = resp.networkHint ? ` — ${resp.networkHint}` : "";
    throw new Error(
      `Telegram Bot API sendDocument failed: ${resp.description ?? "Unknown error"}${hintSuffix}`
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
  fn: (client: import("telegram").TelegramClient) => Promise<T>,
  options?: { connectTimeoutMs?: number; isTest?: boolean }
): Promise<T> {
  const nodeRequire = createRequire(import.meta.url);
  const tg = nodeRequire("telegram") as typeof import("telegram");
  const { TelegramClient, Logger, sessions } = tg;
  const { StringSession } = sessions;

  const isTest = Boolean(options?.isTest);
  const connectTimeoutMs = options?.connectTimeoutMs ?? (isTest ? 15_000 : 30_000);

  const logger = new Logger("error" as never);
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: isTest ? 1 : 3,
    retryDelay: 1000,
    autoReconnect: !isTest,
    timeout: 10,
    baseLogger: logger,
  });

  let timeoutTimer: NodeJS.Timeout | undefined;
  try {
    const startPromise = client.start({ botAuthToken: botToken });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const err = new Error(
          `MTProto connection timed out after ${Math.round(connectTimeoutMs / 1000)}s (outbound Telegram TCP may be blocked by your host firewall).`
        );
        (err as Error & { code?: string }).code = "ETIMEDOUT";
        reject(err);
      }, connectTimeoutMs);
    });

    await Promise.race([startPromise, timeoutPromise]);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    return await fn(client);
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
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
    return await withMtprotoClient(
      apiId,
      apiHash,
      params.creds.botToken,
      async (client) => {
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
      },
      { connectTimeoutMs: 30_000, isTest: false }
    );
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
 * In 'auto' mode, automatically falls back to Bot API (including custom proxy) if MTProto TCP
 * fails and the archive fits within 50 MB.
 */
export async function uploadBackupFileToTelegram(params: {
  creds: TelegramCredentials;
  filePath: string;
  fileName?: string;
  caption: string;
}): Promise<TelegramUploadResult> {
  const creds = normalizeCredentials(params.creds);
  const stat = await fs.promises.stat(params.filePath);
  const fileName = params.fileName || path.basename(params.filePath);

  const selection = selectTelegramTransport({
    preference: creds.transportMode,
    fileSizeBytes: stat.size,
    hasBotToken: Boolean(creds.botToken),
    hasApiId: Boolean(creds.apiId),
    hasApiHash: Boolean(creds.apiHash),
  });

  if (!selection.ok || !selection.transport) {
    throw new Error(selection.error || "Unable to select a valid Telegram upload transport.");
  }

  if (selection.transport === "mtproto") {
    try {
      return await sendDocumentViaMtproto({
        creds,
        filePath: params.filePath,
        fileName,
        caption: params.caption,
      });
    } catch (mtprotoErr) {
      if (creds.transportMode === "auto" && stat.size <= BOT_API_MAX_BYTES) {
        return sendDocumentViaBotApi({
          creds,
          filePath: params.filePath,
          fileName,
          caption: params.caption,
        });
      }
      throw mtprotoErr;
    }
  }

  return sendDocumentViaBotApi({
    creds,
    filePath: params.filePath,
    fileName,
    caption: params.caption,
  });
}

/** Sends a concise status/cleanup text notice to the configured Telegram backup chat. */
export async function sendTelegramStatusMessage(
  rawCreds: TelegramCredentials,
  text: string
): Promise<{ ok: boolean; messageId: string | null; error?: string; networkHint?: string }> {
  const creds = normalizeCredentials(rawCreds);
  if (!creds.botToken || !creds.chatId) {
    return { ok: false, messageId: null, error: "Bot Token or Chat ID is missing." };
  }
  const threadId = parseThreadId(creds.threadId);
  const payload: Record<string, unknown> = {
    chat_id: creds.chatId,
    text: text.slice(0, 4096),
    disable_web_page_preview: true,
  };
  if (threadId) {
    payload.message_thread_id = threadId;
  }

  const resp = await callBotApiJson<{ message_id?: number }>({
    botToken: creds.botToken,
    apiBaseUrl: creds.apiBaseUrl,
    method: "sendMessage",
    jsonBody: payload,
    timeoutMs: 25_000,
  });

  return {
    ok: resp.ok,
    messageId: resp.result?.message_id != null ? String(resp.result.message_id) : null,
    error: resp.description,
    networkHint: resp.networkHint,
  };
}

/**
 * Tests Telegram Bot API credentials, optionally verifies MTProto handshake with
 * api_id + api_hash (large-file mode), and optionally sends a ping message to chatId.
 */
export async function testTelegramConnection(
  rawCreds: TelegramCredentials,
  sendPingMessage: boolean
): Promise<TelegramConnectionTestResult> {
  const creds = normalizeCredentials(rawCreds);
  const warnings: string[] = [];

  if (!creds.botToken) {
    return {
      ok: false,
      botUsername: null,
      botFirstName: null,
      botApiOk: false,
      mtprotoTested: false,
      mtprotoOk: false,
      messageSent: false,
      messageId: null,
      endpointUsed: creds.apiBaseUrl || DEFAULT_TELEGRAM_BOT_API_BASE,
      warnings,
      error: "Telegram Bot Token is required.",
      networkHint: "Paste the Bot Token from @BotFather in the Bot Token field and click Test again.",
    };
  }

  // Validate custom API URL early before touching network
  const urlCheck = validateTelegramApiBaseUrl(creds.apiBaseUrl || "");
  if (!urlCheck.ok) {
    return {
      ok: false,
      botUsername: null,
      botFirstName: null,
      botApiOk: false,
      mtprotoTested: false,
      mtprotoOk: false,
      messageSent: false,
      messageId: null,
      endpointUsed: creds.apiBaseUrl || DEFAULT_TELEGRAM_BOT_API_BASE,
      warnings,
      error: urlCheck.error,
      networkHint: urlCheck.error,
    };
  }

  // 1. Verify Bot Token via Bot API getMe
  const me = await callBotApiJson<{ id?: number; username?: string; first_name?: string }>({
    botToken: creds.botToken,
    apiBaseUrl: urlCheck.normalized,
    method: "getMe",
    timeoutMs: 18_000,
  });

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
      endpointUsed: me.endpointUsed,
      networkHint: me.networkHint,
      warnings,
      error: `Bot API connection failed: ${me.description ?? "Invalid token or unreachable endpoint"}`,
    };
  }

  const botUsername = me.result?.username ?? null;
  const botFirstName = me.result?.first_name ?? null;

  // 2. Verify MTProto handshake if api_id + api_hash are configured (and mode uses MTProto)
  let mtprotoTested = false;
  let mtprotoOk = false;
  let mtprotoError: string | undefined;
  const hasApiId = Boolean(creds.apiId);
  const hasApiHash = Boolean(creds.apiHash);

  if (creds.transportMode === "bot_api") {
    warnings.push("Bot API mode selected — MTProto check skipped (50 MB max per file).");
  } else if (hasApiId && hasApiHash) {
    mtprotoTested = true;
    const numericApiId = Number(creds.apiId);
    if (!Number.isInteger(numericApiId) || numericApiId <= 0) {
      mtprotoError = "Telegram api_id must be a positive integer.";
      warnings.push(mtprotoError);
    } else {
      try {
        await withMtprotoClient(
          numericApiId,
          creds.apiHash!,
          creds.botToken,
          async (client) => {
            await client.getMe();
          },
          { connectTimeoutMs: 15_000, isTest: true }
        );
        mtprotoOk = true;
      } catch (err) {
        const clean = redactBackupSecrets(
          err instanceof Error ? err.message : "MTProto handshake failed"
        );
        mtprotoError = `MTProto handshake failed: ${clean}`;
        warnings.push(
          creds.transportMode === "auto"
            ? `${mtprotoError} (Auto mode will still upload archives up to 50 MB via Bot API.)`
            : mtprotoError
        );
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
  let sendHint: string | undefined;

  if (sendPingMessage) {
    if (!creds.chatId) {
      sendError = "Target Chat / Channel ID is required to send a test message.";
      sendHint =
        "Enter your numeric Chat/Channel ID (e.g. -1001234567890) or @channel_username, then test again.";
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
      const sent = await sendTelegramStatusMessage(
        { ...creds, apiBaseUrl: urlCheck.normalized },
        pingText
      );
      messageSent = sent.ok;
      messageId = sent.messageId;
      if (!sent.ok) {
        sendError = sent.error ?? "Failed to send test message to chat.";
        sendHint = sent.networkHint;
      }
    }
  }

  const mtprotoRequiredButFailed = creds.transportMode === "mtproto" && !mtprotoOk;
  const overallOk =
    me.ok &&
    (!sendPingMessage || messageSent) &&
    !mtprotoRequiredButFailed;

  const finalError =
    sendError ||
    (mtprotoRequiredButFailed
      ? mtprotoError || "MTProto mode requires valid api_id, api_hash, and direct Telegram TCP connectivity."
      : undefined);

  const finalHint =
    sendHint ||
    (mtprotoRequiredButFailed
      ? "MTProto connects directly over TCP and cannot route through an HTTP Bot API proxy. If your host blocks Telegram TCP, switch Transport Mode to 'Auto' or 'Bot API Only' and use a Custom HTTPS Bot API Proxy URL."
      : undefined);

  return {
    ok: overallOk,
    botUsername,
    botFirstName,
    botApiOk: true,
    mtprotoTested,
    mtprotoOk,
    messageSent,
    messageId,
    endpointUsed: me.endpointUsed,
    networkHint: finalHint,
    warnings,
    error: finalError,
  };
}
