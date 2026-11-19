import path from "node:path";
import fs from "node:fs/promises";
import dns from "node:dns/promises";
import net from "node:net";
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { execute } from "./db";
import { detectImageFormat } from "./media-validation";
import { stripHtml } from "./sanitize";
import { logActivity } from "./activity-log";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "media");
const THUMB_DIR = path.join(process.cwd(), "public", "uploads", "thumbnails");
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

export interface IngestedMedia {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  path: string;
  thumbnailPath: string;
  altText: string;
  mdxSnippet: string;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const oct = Number(part);
    if (oct < 0 || oct > 255) return null;
    num = (num << 8) | oct;
  }
  return num >>> 0;
}

/**
 * Pure SSRF guard: rejects loopback, RFC1918 private, link-local (AWS/GCP metadata 169.254.169.254),
 * CGNAT, multicast, and reserved IPv4/IPv6 addresses.
 */
export function isPrivateOrReservedIp(ipRaw: string): boolean {
  const ip = ipRaw.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!ip) return true;

  // Handle IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1
  if (ip.startsWith("::ffff:")) {
    const mapped = ip.slice("::ffff:".length);
    if (net.isIPv4(mapped)) {
      return isPrivateOrReservedIp(mapped);
    }
  }

  if (net.isIPv4(ip)) {
    const val = ipv4ToInt(ip);
    if (val === null) return true;
    const first = (val >>> 24) & 0xff;
    const second = (val >>> 16) & 0xff;

    if (first === 0) return true; // 0.0.0.0/8
    if (first === 10) return true; // 10.0.0.0/8
    if (first === 100 && second >= 64 && second <= 127) return true; // 100.64.0.0/10 CGNAT
    if (first === 127) return true; // 127.0.0.0/8 loopback
    if (first === 169 && second === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
    if (first === 172 && second >= 16 && second <= 31) return true; // 172.16.0.0/12
    if (first === 192 && second === 168) return true; // 192.168.0.0/16
    if (first === 192 && second === 0 && ((val >>> 8) & 0xff) === 0) return true; // 192.0.0.0/24
    if (first === 198 && (second === 18 || second === 19)) return true; // 198.18.0.0/15 benchmark
    if (first >= 224) return true; // multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    if (ip === "::" || ip === "::1") return true;
    if (ip.startsWith("fe80:") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true; // fe80::/10 link-local
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7 ULA
    if (ip.startsWith("ff")) return true; // ff00::/8 multicast
    return false;
  }

  return true;
}

/**
 * Validates that an external URL is strictly public HTTPS (or HTTP only when explicitly permitted in tests)
 * with no credentials, no custom ports, and no internal hostnames.
 */
export function validateExternalImageUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, reason: "Image URL must be a non-empty string." };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: "Malformed image URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "External image URLs must use HTTPS." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Image URLs must not embed credentials." };
  }
  if (parsed.port && parsed.port !== "443") {
    return { ok: false, reason: "Custom ports are blocked on remote image URLs." };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa")
  ) {
    return { ok: false, reason: "Local or internal hostnames are blocked." };
  }

  if (net.isIP(host) && isPrivateOrReservedIp(host)) {
    return { ok: false, reason: "Private or reserved IP addresses are blocked." };
  }

  return { ok: true, url: parsed };
}

async function assertHostResolvesPublicly(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Blocked private IP address.");
    }
    return;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records || records.length === 0) {
    throw new Error("Could not resolve image hostname.");
  }
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error("Image hostname resolved to a private or reserved network address.");
    }
  }
}

export async function fetchSafeRemoteImage(rawUrl: string): Promise<{ buffer: Buffer; filename: string }> {
  let currentUrl = rawUrl;

  for (let hops = 0; hops <= 3; hops++) {
    const check = validateExternalImageUrl(currentUrl);
    if (!check.ok) {
      throw new Error(check.reason);
    }
    await assertHostResolvesPublicly(check.url.hostname.replace(/^\[|\]$/g, ""));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(check.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Scienta-MediaFetcher/1.0",
          Accept: "image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Remote server returned redirect without Location header.");
      currentUrl = new URL(location, check.url).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`Remote image fetch failed with HTTP ${res.status}.`);
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error("Remote image exceeds the 8MB maximum limit.");
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_IMAGE_BYTES) {
        throw new Error("Remote image exceeds the 8MB maximum limit.");
      }
      const fallbackName = path.basename(check.url.pathname) || "remote-image";
      return { buffer: Buffer.from(ab), filename: fallbackName };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          throw new Error("Remote image exceeds the 8MB maximum limit.");
        }
        chunks.push(value);
      }
    }

    const buffer = Buffer.concat(chunks);
    const filename = path.basename(check.url.pathname) || "remote-image";
    return { buffer, filename };
  }

  throw new Error("Too many redirects while fetching remote image.");
}

export function decodeBase64Image(input: string): Buffer {
  const trimmed = input.trim();
  const dataUriMatch = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,([a-zA-Z0-9+/=\s]+)$/i.exec(trimmed);
  const b64 = dataUriMatch ? dataUriMatch[1].replace(/\s+/g, "") : trimmed.replace(/\s+/g, "");
  if (!b64 || !/^[a-zA-Z0-9+/=]+$/.test(b64)) {
    throw new Error("Invalid base64 image payload.");
  }
  const estimatedBytes = Math.ceil((b64.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES + 1024) {
    throw new Error("Base64 image exceeds the 8MB size limit.");
  }
  return Buffer.from(b64, "base64");
}

export async function ingestImageBuffer(params: {
  buffer: Buffer;
  originalName: string;
  altText?: string;
  uploadedByUserId: string;
  ipAddress: string;
  auditMeta?: Record<string, unknown>;
}): Promise<IngestedMedia> {
  if (params.buffer.length === 0) {
    throw new Error("Image file is empty.");
  }
  if (params.buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Image file exceeds the 8MB size limit.");
  }

  const detected = detectImageFormat(params.buffer);
  if (!detected) {
    throw new Error("Unsupported or invalid image binary. Allowed formats: JPEG, PNG, WebP, GIF.");
  }

  let width: number | null = null;
  let height: number | null = null;
  const id = uuid();
  const filename = `${id}.${detected.ext}`;
  const thumbFilename = `${id}_thumb.webp`;

  let safeImageBuffer: Buffer;
  let thumbBuffer: Buffer;
  try {
    const sharpOpts = { limitInputPixels: 25_000_000, failOn: "error" as const };
    const image = sharp(params.buffer, sharpOpts);
    const meta = await image.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;

    if (detected.ext === "jpg") {
      safeImageBuffer = await sharp(params.buffer, sharpOpts).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    } else if (detected.ext === "png") {
      safeImageBuffer = await sharp(params.buffer, sharpOpts).rotate().png({ compressionLevel: 8 }).toBuffer();
    } else if (detected.ext === "webp") {
      safeImageBuffer = await sharp(params.buffer, sharpOpts).rotate().webp({ quality: 86 }).toBuffer();
    } else {
      safeImageBuffer = params.buffer;
    }

    thumbBuffer = await sharp(params.buffer, sharpOpts)
      .rotate()
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("Corrupted, oversized, or unreadable image file.");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), safeImageBuffer);
  await fs.writeFile(path.join(THUMB_DIR, thumbFilename), thumbBuffer);

  const publicPath = `/uploads/media/${filename}`;
  const thumbnailPath = `/uploads/thumbnails/${thumbFilename}`;
  const safeOriginalName = stripHtml(params.originalName).slice(0, 255) || filename;
  const safeAlt = stripHtml(params.altText ?? "").slice(0, 255);

  await execute(
    `INSERT INTO media (id, filename, original_name, mime_type, size_bytes, width, height, path, thumbnail_path, alt_text, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      filename,
      safeOriginalName,
      detected.mime,
      safeImageBuffer.length,
      width,
      height,
      publicPath,
      thumbnailPath,
      safeAlt || null,
      params.uploadedByUserId,
    ]
  );

  await logActivity({
    userId: params.uploadedByUserId,
    action: "api.media.upload",
    entityType: "media",
    entityId: id,
    meta: { ...(params.auditMeta ?? {}), originalName: safeOriginalName, mimeType: detected.mime },
    ipAddress: params.ipAddress,
  });

  const escapedAlt = (safeAlt || safeOriginalName).replace(/"/g, "'");
  return {
    id,
    filename,
    originalName: safeOriginalName,
    mimeType: detected.mime,
    sizeBytes: safeImageBuffer.length,
    width,
    height,
    path: publicPath,
    thumbnailPath,
    altText: safeAlt,
    mdxSnippet: `<Figure src="${publicPath}" alt="${escapedAlt}" caption="${escapedAlt}" />`,
  };
}
