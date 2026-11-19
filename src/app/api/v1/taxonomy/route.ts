import { authenticateV1Request, v1CorsPreflight, v1Json } from "@/lib/ai-api-auth";
import { query } from "@/lib/db";

export async function OPTIONS() {
  return v1CorsPreflight();
}

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req, "taxonomy:read");
  if (!auth.ok) return auth.response;

  const [fields, categories, authors, tags] = await Promise.all([
    query<{ id: string; slug: string; name_fa: string; name_en: string; color: string; icon: string }>(
      `SELECT id, slug, name_fa, name_en, color, icon FROM fields WHERE deleted_at IS NULL ORDER BY sort_order ASC`
    ),
    query<{ id: string; slug: string; name_fa: string; name_en: string; description_fa: string | null; description_en: string | null }>(
      `SELECT id, slug, name_fa, name_en, description_fa, description_en FROM categories WHERE deleted_at IS NULL ORDER BY name_en ASC`
    ),
    query<{ id: string; slug: string; name_fa: string; name_en: string; title_fa: string | null; title_en: string | null }>(
      `SELECT id, slug, name_fa, name_en, title_fa, title_en FROM authors WHERE deleted_at IS NULL ORDER BY name_en ASC`
    ),
    query<{ id: string; slug: string; name_fa: string; name_en: string }>(
      `SELECT id, slug, name_fa, name_en FROM tags ORDER BY name_en ASC`
    ),
  ]);

  return v1Json(
    {
      fields,
      categories,
      authors,
      tags,
    },
    { requestId: auth.requestId, headers: auth.rateHeaders }
  );
}
