import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { authenticateV1Request, getPublicOrigin, v1CorsPreflight, v1Error, v1Json } from "@/lib/ai-api-auth";
import { decodeBase64Image, fetchSafeRemoteImage, ingestImageBuffer } from "@/lib/ai-api-media";

const jsonUploadSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().min(16).optional(),
  filename: z.string().max(180).optional(),
  altText: z.string().max(255).optional(),
});

export async function OPTIONS() {
  return v1CorsPreflight();
}

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req, "media:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(60, Math.max(1, Number(url.searchParams.get("pageSize") ?? 30)));
  const offset = (page - 1) * pageSize;

  const items = await query<{
    id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    width: number | null;
    height: number | null;
    path: string;
    thumbnail_path: string | null;
    alt_text: string | null;
    created_at: string;
  }>(
    `SELECT id, filename, original_name, mime_type, size_bytes, width, height, path, thumbnail_path, alt_text, created_at
       FROM media
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );

  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM media WHERE deleted_at IS NULL`
  );

  const origin = getPublicOrigin(req);

  return v1Json(
    {
      items: items.map((item) => ({
        ...item,
        url: `${origin}${item.path}`,
        thumbnailUrl: item.thumbnail_path ? `${origin}${item.thumbnail_path}` : null,
      })),
      page,
      pageSize,
      total: Number(totalRow?.count ?? 0),
    },
    { requestId: auth.requestId, headers: auth.rateHeaders }
  );
}

export async function POST(req: Request) {
  const auth = await authenticateV1Request(req, "media:write");
  if (!auth.ok) return auth.response;

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  let buffer: Buffer;
  let originalName = "ai-upload.png";
  let altText = "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData().catch(() => null);
      const file = formData?.get("file");
      if (!file || !(file instanceof File)) {
        return v1Error({
          status: 400,
          code: "missing_file",
          message: "No 'file' field provided in multipart/form-data payload.",
          hint: "Send multipart/form-data with field name 'file' or use application/json with imageUrl or imageBase64.",
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      buffer = Buffer.from(await file.arrayBuffer());
      originalName = file.name || originalName;
      const altField = formData?.get("altText");
      if (typeof altField === "string") altText = altField;
    } else {
      const body = await req.json().catch(() => null);
      const parsed = jsonUploadSchema.safeParse(body);
      if (!parsed.success || (!parsed.data.imageUrl && !parsed.data.imageBase64)) {
        return v1Error({
          status: 400,
          code: "validation_error",
          message: "Provide either 'imageUrl' (HTTPS) or 'imageBase64' in JSON body, or send multipart/form-data.",
          details: parsed.success ? undefined : parsed.error.flatten(),
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }

      altText = parsed.data.altText ?? "";
      if (parsed.data.imageBase64) {
        buffer = decodeBase64Image(parsed.data.imageBase64);
        originalName = parsed.data.filename?.trim() || "ai-generated.png";
      } else {
        const fetched = await fetchSafeRemoteImage(parsed.data.imageUrl!);
        buffer = fetched.buffer;
        originalName = parsed.data.filename?.trim() || fetched.filename;
      }
    }

    const media = await ingestImageBuffer({
      buffer,
      originalName,
      altText,
      uploadedByUserId: auth.key.ownerUserId,
      ipAddress: auth.ip,
      auditMeta: {
        apiKeyId: auth.key.id,
        apiKeyName: auth.key.name,
        apiKeyPrefix: auth.key.keyPrefix,
      },
    });

    const origin = getPublicOrigin(req);
    return v1Json(
      {
        media: {
          ...media,
          url: `${origin}${media.path}`,
          thumbnailUrl: `${origin}${media.thumbnailPath}`,
        },
      },
      { status: 201, requestId: auth.requestId, headers: auth.rateHeaders }
    );
  } catch (err) {
    return v1Error({
      status: 400,
      code: "media_ingest_failed",
      message: err instanceof Error ? err.message : "Failed to process image upload.",
      hint: "Ensure the image is a valid PNG, JPEG, WebP, or GIF under 8MB.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }
}
