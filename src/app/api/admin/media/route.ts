import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { query, queryOne, execute } from "@/lib/db";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { rateLimit } from "@/lib/rate-limit";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "media");
const THUMB_DIR = path.join(process.cwd(), "public", "uploads", "thumbnails");
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

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
  if (file.size > MAX_SIZE_BYTES) return badRequest("File exceeds the 8MB size limit");
  if (!ALLOWED_MIME.has(file.type)) return badRequest("Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, SVG");

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });

  const id = uuid();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filename = `${id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);

  let width: number | null = null;
  let height: number | null = null;
  let thumbnailPublicPath: string | null = null;

  if (file.type !== "image/svg+xml") {
    try {
      const image = sharp(buffer);
      const meta = await image.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;

      const thumbFilename = `${id}_thumb.webp`;
      await image
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(THUMB_DIR, thumbFilename));
      thumbnailPublicPath = `/uploads/thumbnails/${thumbFilename}`;
    } catch (err) {
      console.error("[media] thumbnail generation failed:", err);
    }
  }

  const publicPath = `/uploads/media/${filename}`;

  await execute(
    `INSERT INTO media (id, filename, original_name, mime_type, size_bytes, width, height, path, thumbnail_path, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, filename, file.name, file.type, file.size, width, height, publicPath, thumbnailPublicPath, session!.sub]
  );

  await logActivity({ userId: session!.sub, action: "media.upload", entityType: "media", entityId: id, ipAddress: ip });

  return NextResponse.json(
    { id, path: publicPath, thumbnailPath: thumbnailPublicPath, width, height, originalName: file.name },
    { status: 201 }
  );
}
