import { authenticateV1Request, getPublicOrigin, v1CorsPreflight, v1Json } from "@/lib/ai-api-auth";
import { queryOne } from "@/lib/db";

export async function OPTIONS() {
  return v1CorsPreflight();
}

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return auth.response;

  const defaultAuthor = auth.key.defaultAuthorId
    ? await queryOne<{ id: string; slug: string; name_en: string; name_fa: string }>(
        `SELECT id, slug, name_en, name_fa FROM authors WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [auth.key.defaultAuthorId]
      )
    : null;

  return v1Json(
    {
      apiKey: {
        id: auth.key.id,
        name: auth.key.name,
        keyPrefix: auth.key.keyPrefix,
        scopes: auth.key.scopes,
        rateLimitPerMin: auth.key.rateLimitPerMin,
        requestCount: auth.key.requestCount,
        expiresAt: auth.key.expiresAt,
        owner: {
          id: auth.key.ownerUserId,
          name: auth.key.ownerName,
          role: auth.key.ownerRole,
        },
        defaultAuthor: defaultAuthor
          ? {
              id: defaultAuthor.id,
              slug: defaultAuthor.slug,
              nameEn: defaultAuthor.name_en,
              nameFa: defaultAuthor.name_fa,
            }
          : null,
      },
      endpoints: {
        openApiSpec: `${getPublicOrigin(req)}/api/v1/openapi.json`,
        schema: `${getPublicOrigin(req)}/api/v1/schema`,
        taxonomy: `${getPublicOrigin(req)}/api/v1/taxonomy`,
        media: `${getPublicOrigin(req)}/api/v1/media`,
        articles: `${getPublicOrigin(req)}/api/v1/articles`,
      },
    },
    { requestId: auth.requestId, headers: auth.rateHeaders }
  );
}
