import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import path from "node:path";
import fs from "node:fs/promises";
import { loadSharp } from "@/lib/sharp-loader";
import { query, queryOne, execute } from "@/lib/db";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { detectImageFormat } from "@/lib/media-validation";
import { stripHtml } from "@/lib/sanitize";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "media");
const THUMB_DIR = path.join(process.cwd(), "public", "uploads", "thumbnails");
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export async function GET(req: Request) {
  const { response } = await requireApiAuth("media.manage");
  if (response) return response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(60, Math.max(1, Number(url.searchParams.get("pageSize") ?? 30)));
  const offset = (page - 1) * pageSize;

  const items = await query(
    `SELECT id, filename, original_name, mime_type, size_bytes, width, height, path, thumbnail_path, alt_text, created_at
     FROM media WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM media WHERE deleted_at IS NULL`);

  return NextResponse.json({ items, page, pageSize, total: totalRow?.count ?? 0 });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "media.manage");
  if (response) return response;

  const ip = getClientIp(req);
  const limit = rateLimit(`upload:${session!.sub}`, 30, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Upload rate limit exceeded" }, { status: 429 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return badRequest("No file provided");
  if (file.size === 0) return badRequest("File is empty");
  if (file.size > MAX_SIZE_BYTES) return badRequest("File exceeds the 8MB size limit");

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageFormat(buffer);
  if (!detected) {
    return badRequest("Unsupported or invalid image file. Allowed formats: JPEG, PNG, WebP, GIF (SVG is disabled for security).");
  }

  let width: number | null = null;
  let height: number | null = null;
  const id = uuid();
  const filename = `${id}.${detected.ext}`;
  const thumbFilename = `${id}_thumb.webp`;

  let safeImageBuffer: Buffer = buffer;
  let thumbBuffer: Buffer | null = null;
  const sharp = loadSharp();
  if (sharp) {
    try {
      // Guard against decompression bombs (pixel-flood attacks) with a 25 MP ceiling.
      const sharpOpts = { limitInputPixels: 25_000_000, failOn: "error" as const };
      const image = sharp(buffer, sharpOpts);
      const meta = await image.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;

      // Re-encode static formats (JPEG/PNG/WebP) to strip EXIF/GPS metadata and neutralize
      // polyglot trailing payloads; keep animated GIFs verified after metadata validation.
      if (detected.ext === "jpg") {
        safeImageBuffer = await sharp(buffer, sharpOpts).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      } else if (detected.ext === "png") {
        safeImageBuffer = await sharp(buffer, sharpOpts).rotate().png({ compressionLevel: 8 }).toBuffer();
      } else if (detected.ext === "webp") {
        safeImageBuffer = await sharp(buffer, sharpOpts).rotate().webp({ quality: 86 }).toBuffer();
      } else {
        safeImageBuffer = buffer;
      }

      thumbBuffer = await sharp(buffer, sharpOpts)
        .rotate()
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return badRequest("Corrupted, oversized, or unreadable image file.");
    }
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), safeImageBuffer);

  const publicPath = `/uploads/media/${filename}`;
  let thumbnailPublicPath = publicPath;
  if (thumbBuffer) {
    await fs.mkdir(THUMB_DIR, { recursive: true });
    await fs.writeFile(path.join(THUMB_DIR, thumbFilename), thumbBuffer);
    thumbnailPublicPath = `/uploads/thumbnails/${thumbFilename}`;
  }
  const safeOriginalName = stripHtml(file.name).slice(0, 255) || filename;

  await execute(
    `INSERT INTO media (id, filename, original_name, mime_type, size_bytes, width, height, path, thumbnail_path, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, filename, safeOriginalName, detected.mime, safeImageBuffer.length, width, height, publicPath, thumbnailPublicPath, session!.sub]
  );

  await logActivity({ userId: session!.sub, action: "media.upload", entityType: "media", entityId: id, ipAddress: ip });

  return NextResponse.json(
    { id, path: publicPath, thumbnailPath: thumbnailPublicPath, width, height, originalName: safeOriginalName },
    { status: 201 }
  );
}
