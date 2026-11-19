import { authenticateV1Request, getPublicOrigin, v1CorsPreflight, v1Json } from "@/lib/ai-api-auth";
import { SCIENTA_MDX_GUIDE } from "@/lib/ai-api-articles";
import { query } from "@/lib/db";

export async function OPTIONS() {
  return v1CorsPreflight();
}

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req, "taxonomy:read");
  if (!auth.ok) return auth.response;

  const [fields, categories, authors] = await Promise.all([
    query<{ slug: string; name_en: string; name_fa: string }>(
      `SELECT slug, name_en, name_fa FROM fields WHERE deleted_at IS NULL ORDER BY sort_order ASC`
    ),
    query<{ slug: string; name_en: string; name_fa: string }>(
      `SELECT slug, name_en, name_fa FROM categories WHERE deleted_at IS NULL ORDER BY name_en ASC`
    ),
    query<{ slug: string; name_en: string; name_fa: string }>(
      `SELECT slug, name_en, name_fa FROM authors WHERE deleted_at IS NULL ORDER BY name_en ASC`
    ),
  ]);

  const origin = getPublicOrigin(req);

  return v1Json(
    {
      platform: "Scienta Scientific Publishing",
      apiVersion: "v1",
      openApiUrl: `${origin}/api/v1/openapi.json`,
      grantedScopes: auth.key.scopes,
      recommendedWorkflow: [
        "1. Call GET /api/v1/taxonomy to inspect available fields, categories, authors, and existing tags.",
        "2. Optional: Call POST /api/v1/media with an image file, base64 payload, or HTTPS imageUrl to upload cover & figure graphics.",
        "3. Optional: Call POST /api/v1/articles with dryRun=true to validate MDX safety, slug uniqueness, and reading metrics without writing.",
        "4. Call POST /api/v1/articles with Idempotency-Key header to create a draft or live published bilingual article.",
      ],
      taxonomySummary: {
        fieldSlugs: fields.map((f) => ({ slug: f.slug, en: f.name_en, fa: f.name_fa })),
        categorySlugs: categories.map((c) => ({ slug: c.slug, en: c.name_en, fa: c.name_fa })),
        authorSlugs: authors.map((a) => ({ slug: a.slug, en: a.name_en, fa: a.name_fa })),
      },
      mdxGuide: SCIENTA_MDX_GUIDE,
    },
    { requestId: auth.requestId, headers: auth.rateHeaders }
  );
}
