import { z } from "zod";
import readingTime from "reading-time";
import { v4 as uuid } from "uuid";
import { execute, queryOne } from "./db";
import { generateSlug, stripHtml } from "./sanitize";
import { sanitizeUrl, validateMdxSafety } from "./security";
import { extractToc } from "./content";
import { API_SCOPES, SCOPE_CATALOG } from "./ai-api-auth";

export const aiTranslationInputSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().min(1).max(255).optional(),
  excerpt: z.string().max(500).optional().default(""),
  content: z.string().min(1).max(250_000),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(320).optional(),
  seoKeywords: z.string().max(500).optional(),
  canonicalUrl: z.string().max(500).optional(),
  twitterCard: z.enum(["summary", "summary_large_image"]).optional().default("summary_large_image"),
});

export type AiTranslationInput = z.infer<typeof aiTranslationInputSchema>;

export const aiTagObjectSchema = z.object({
  slug: z.string().min(1).max(160).optional(),
  nameFa: z.string().min(1).max(160).optional(),
  nameEn: z.string().min(1).max(160),
});

export const aiCreateArticleSchema = z.object({
  // Taxonomy selectors: UUID or human-readable slug
  fieldId: z.string().uuid().nullable().optional(),
  field: z.string().min(1).max(100).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  category: z.string().min(1).max(160).optional(),
  authorId: z.string().uuid().nullable().optional(),
  author: z.string().min(1).max(160).optional(),

  // Cover media: existing media ID, uploaded /uploads/... path, or remote HTTPS imageUrl
  coverMediaId: z.string().uuid().nullable().optional(),
  coverMediaUrl: z.string().max(1000).optional(),
  coverAltText: z.string().max(255).optional(),

  // Tags: UUIDs, slugs, or bilingual objects
  tagIds: z.array(z.string().uuid()).max(30).optional().default([]),
  tags: z.array(z.union([z.string().min(1).max(160), aiTagObjectSchema])).max(30).optional().default([]),
  autoCreateTags: z.boolean().optional().default(true),

  // Publishing controls
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  featured: z.boolean().optional().default(false),
  trending: z.boolean().optional().default(false),
  scheduledAt: z.string().datetime().nullable().optional(),
  dryRun: z.boolean().optional().default(false),
  mirrorMissingLocale: z.boolean().optional().default(true),
  conflictStrategy: z.enum(["error", "suffix"]).optional().default("error"),

  // Either provide `translations: { fa?, en? }` OR shorthand `{ locale, title, content, ... }`
  translations: z
    .object({
      fa: aiTranslationInputSchema.optional(),
      en: aiTranslationInputSchema.optional(),
    })
    .optional(),
  locale: z.enum(["fa", "en"]).optional(),
  title: z.string().min(3).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1).max(250_000).optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(320).optional(),
  seoKeywords: z.string().max(500).optional(),
  canonicalUrl: z.string().max(500).optional(),
  twitterCard: z.enum(["summary", "summary_large_image"]).optional(),
});

export type AiCreateArticleRaw = z.infer<typeof aiCreateArticleSchema>;

export const aiPatchArticleSchema = z.object({
  fieldId: z.string().uuid().nullable().optional(),
  field: z.string().min(1).max(100).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  category: z.string().min(1).max(160).optional(),
  authorId: z.string().uuid().nullable().optional(),
  author: z.string().min(1).max(160).optional(),
  coverMediaId: z.string().uuid().nullable().optional(),
  coverMediaUrl: z.string().max(1000).optional(),
  coverAltText: z.string().max(255).optional(),
  tagIds: z.array(z.string().uuid()).max(30).optional(),
  tags: z.array(z.union([z.string().min(1).max(160), aiTagObjectSchema])).max(30).optional(),
  autoCreateTags: z.boolean().optional().default(true),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  featured: z.boolean().optional(),
  trending: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  revisionNote: z.string().max(255).optional(),
  translations: z
    .object({
      fa: aiTranslationInputSchema.partial().optional(),
      en: aiTranslationInputSchema.partial().optional(),
    })
    .optional(),
});

export interface NormalizedArticleTranslations {
  fa: AiTranslationInput;
  en: AiTranslationInput;
  warnings: string[];
}

/**
 * Accepts either full bilingual `{ translations: { fa, en } }`, single-locale
 * `{ translations: { en } }`, or top-level shorthand `{ locale: "en", title, content }`,
 * validates MDX safety + canonical URLs, and prepares clean slugs for both locales.
 */
export function normalizeAiArticleTranslations(
  data: AiCreateArticleRaw
): { ok: true; value: NormalizedArticleTranslations } | { ok: false; message: string; hint: string } {
  const warnings: string[] = [];
  let fa = data.translations?.fa;
  let en = data.translations?.en;

  if (!fa && !en && data.title && data.content) {
    const loc = data.locale ?? "en";
    const single: AiTranslationInput = {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt ?? "",
      content: data.content,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      seoKeywords: data.seoKeywords,
      canonicalUrl: data.canonicalUrl,
      twitterCard: data.twitterCard ?? "summary_large_image",
    };
    if (loc === "fa") fa = single;
    else en = single;
  }

  if (!fa && !en) {
    return {
      ok: false,
      message: "Article content is missing.",
      hint: "Provide `translations: { fa: { title, content }, en: { title, content } }`, or provide `locale` + `title` + `content`.",
    };
  }

  if (!fa && en) {
    if (!data.mirrorMissingLocale) {
      return {
        ok: false,
        message: "Missing Persian ('fa') translation while mirrorMissingLocale=false.",
        hint: "Include `translations.fa` or omit/set `mirrorMissingLocale: true`.",
      };
    }
    const baseSlug = en.slug?.trim() || generateSlug(en.title, "en") || `article-${Date.now()}`;
    fa = { ...en, slug: baseSlug };
    en = { ...en, slug: baseSlug };
    warnings.push("Mirrored 'en' content into 'fa' translation because 'translations.fa' was omitted.");
  } else if (fa && !en) {
    if (!data.mirrorMissingLocale) {
      return {
        ok: false,
        message: "Missing English ('en') translation while mirrorMissingLocale=false.",
        hint: "Include `translations.en` or omit/set `mirrorMissingLocale: true`.",
      };
    }
    const baseSlug = fa.slug?.trim() || generateSlug(fa.title, "fa") || `article-${Date.now()}`;
    en = { ...fa, slug: baseSlug };
    fa = { ...fa, slug: baseSlug };
    warnings.push("Mirrored 'fa' content into 'en' translation because 'translations.en' was omitted.");
  }

  // At this point both fa and en are guaranteed defined.
  const finalizedFa = { ...fa! };
  const finalizedEn = { ...en! };

  finalizedEn.slug = finalizedEn.slug?.trim() || generateSlug(finalizedEn.title, "en");
  finalizedFa.slug = finalizedFa.slug?.trim() || generateSlug(finalizedFa.title, "fa") || finalizedEn.slug;

  for (const [loc, tr] of [
    ["fa", finalizedFa],
    ["en", finalizedEn],
  ] as const) {
    const safety = validateMdxSafety(tr.content);
    if (!safety.safe) {
      return {
        ok: false,
        message: `Unsafe MDX content in '${loc}': ${safety.reason ?? "Forbidden construct detected."}`,
        hint: "Remove raw <script>, <iframe>, inline event handlers, or JS imports. Use <VideoEmbed>, <Figure>, <Callout>, <Theorem>, or <StatHighlight>.",
      };
    }
    if (tr.canonicalUrl && tr.canonicalUrl.trim()) {
      const safeCanonical = sanitizeUrl(tr.canonicalUrl, {
        allowRelative: false,
        allowMailto: false,
        allowHash: false,
      });
      if (!safeCanonical) {
        return {
          ok: false,
          message: `Invalid canonicalUrl in '${loc}'.`,
          hint: "Provide a valid http:// or https:// canonical URL.",
        };
      }
      tr.canonicalUrl = safeCanonical;
    }
  }

  return {
    ok: true,
    value: {
      fa: finalizedFa,
      en: finalizedEn,
      warnings,
    },
  };
}

/**
 * Pure static editorial & formatting linter for AI-generated scientific MDX.
 * Catches common LLM authoring mistakes (unbalanced math delimiters, missing
 * headings, short excerpts, missing cover image).
 */
export function lintMdxEditorialQuality(params: {
  content: string;
  excerpt?: string;
  hasCover?: boolean;
  locale: "fa" | "en";
}): string[] {
  const warnings: string[] = [];
  const { content, excerpt, hasCover, locale } = params;

  const strippedCode = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");

  const displayMathCount = (strippedCode.match(/\$\$/g) ?? []).length;
  if (displayMathCount % 2 !== 0) {
    warnings.push(
      `[${locale}] Unbalanced display math delimiter '$$' detected (${displayMathCount} occurrences).`
    );
  }

  if (!/^#{2,3}\s+\S+/m.test(strippedCode)) {
    warnings.push(
      `[${locale}] No '##' or '###' headings found; Table of Contents will be empty.`
    );
  }

  if (!excerpt || excerpt.trim().length < 20) {
    warnings.push(
      `[${locale}] Excerpt is missing or very short (< 20 chars); SEO cards and article listings work best with a 1-2 sentence summary.`
    );
  }

  if (!hasCover) {
    warnings.push(
      `[${locale}] No cover image attached; pass coverMediaId or coverMediaUrl for rich social & homepage cards.`
    );
  }

  return warnings;
}

/**
 * Checks whether a desired slug is free for a given locale.
 * When strategy === "suffix", appends -2, -3, ... automatically until free.
 */
export async function resolveUniqueSlug(
  locale: "fa" | "en",
  desiredSlug: string,
  strategy: "error" | "suffix"
): Promise<{ ok: true; slug: string; suffixed: boolean } | { ok: false; conflictingSlug: string }> {
  const base = desiredSlug.trim();
  const firstTaken = await queryOne<{ id: string }>(
    `SELECT id FROM article_translations WHERE locale = ? AND slug = ? LIMIT 1`,
    [locale, base]
  );
  if (!firstTaken) {
    return { ok: true, slug: base, suffixed: false };
  }
  if (strategy === "error") {
    return { ok: false, conflictingSlug: base };
  }

  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}-${i}`;
    const taken = await queryOne<{ id: string }>(
      `SELECT id FROM article_translations WHERE locale = ? AND slug = ? LIMIT 1`,
      [locale, candidate]
    );
    if (!taken) {
      return { ok: true, slug: candidate, suffixed: true };
    }
  }
  return { ok: true, slug: `${base}-${Date.now().toString(36)}`, suffixed: true };
}

export async function resolveFieldId(fieldId?: string | null, fieldSlug?: string): Promise<string | null> {
  if (fieldId) return fieldId;
  if (!fieldSlug?.trim()) return null;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM fields WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    [fieldSlug.trim().toLowerCase()]
  );
  if (!row) {
    throw new Error(`Unknown scientific field slug '${fieldSlug}'. Call GET /api/v1/taxonomy for valid field slugs.`);
  }
  return row.id;
}

export async function resolveCategoryId(categoryId?: string | null, categorySlug?: string): Promise<string | null> {
  if (categoryId) return categoryId;
  if (!categorySlug?.trim()) return null;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    [categorySlug.trim().toLowerCase()]
  );
  if (!row) {
    throw new Error(`Unknown category slug '${categorySlug}'. Call GET /api/v1/taxonomy for valid categories.`);
  }
  return row.id;
}

export async function resolveAuthorId(
  authorId?: string | null,
  authorSlug?: string,
  fallbackAuthorId?: string | null
): Promise<string | null> {
  if (authorId) return authorId;
  if (authorSlug?.trim()) {
    const row = await queryOne<{ id: string }>(
      `SELECT id FROM authors WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [authorSlug.trim().toLowerCase()]
    );
    if (!row) {
      throw new Error(`Unknown author slug '${authorSlug}'. Call GET /api/v1/taxonomy for valid authors.`);
    }
    return row.id;
  }
  return fallbackAuthorId ?? null;
}

export async function resolveAndCreateTagIds(params: {
  tagIds?: string[];
  tags?: Array<string | z.infer<typeof aiTagObjectSchema>>;
  autoCreateTags: boolean;
  canWriteTaxonomy: boolean;
}): Promise<{ ids: string[]; createdSlugs: string[] }> {
  const resultSet = new Set<string>(params.tagIds ?? []);
  const createdSlugs: string[] = [];

  for (const entry of params.tags ?? []) {
    const rawSlug =
      typeof entry === "string"
        ? generateSlug(entry, "en") || entry.trim().toLowerCase()
        : entry.slug?.trim().toLowerCase() || generateSlug(entry.nameEn, "en");

    if (!rawSlug) continue;

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM tags WHERE slug = ? LIMIT 1`,
      [rawSlug]
    );
    if (existing?.id) {
      resultSet.add(existing.id);
      continue;
    }

    if (!params.autoCreateTags) {
      throw new Error(`Unknown tag '${rawSlug}' (set autoCreateTags: true to create missing tags automatically).`);
    }
    if (!params.canWriteTaxonomy) {
      throw new Error(
        `Tag '${rawSlug}' does not exist and this API key lacks 'taxonomy:write' scope to auto-create tags.`
      );
    }

    const id = uuid();
    const nameEn = typeof entry === "string" ? entry.trim() : stripHtml(entry.nameEn);
    const nameFa = typeof entry === "string" ? entry.trim() : stripHtml(entry.nameFa || entry.nameEn);

    await execute(`INSERT INTO tags (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`, [
      id,
      rawSlug,
      nameFa,
      nameEn,
    ]);
    resultSet.add(id);
    createdSlugs.push(rawSlug);
  }

  return { ids: Array.from(resultSet), createdSlugs };
}

export async function resolveArticleByIdOrSlug(idOrSlug: string) {
  const trimmed = decodeURIComponent(idOrSlug.trim());
  const byId = await queryOne<{
    id: string;
    field_id: string | null;
    category_id: string | null;
    author_id: string | null;
    cover_media_id: string | null;
    status: "draft" | "published" | "scheduled";
    featured: number;
    trending: number;
    views: number;
    published_at: string | null;
    scheduled_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, field_id, category_id, author_id, cover_media_id, status, featured, trending, views, published_at, scheduled_at, created_at, updated_at
       FROM articles
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1`,
    [trimmed]
  );
  if (byId) return byId;

  return queryOne<{
    id: string;
    field_id: string | null;
    category_id: string | null;
    author_id: string | null;
    cover_media_id: string | null;
    status: "draft" | "published" | "scheduled";
    featured: number;
    trending: number;
    views: number;
    published_at: string | null;
    scheduled_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT a.id, a.field_id, a.category_id, a.author_id, a.cover_media_id, a.status, a.featured, a.trending, a.views, a.published_at, a.scheduled_at, a.created_at, a.updated_at
       FROM articles a
       JOIN article_translations t ON t.article_id = a.id
      WHERE t.slug = ? AND a.deleted_at IS NULL
      LIMIT 1`,
    [trimmed]
  );
}

export function buildArticleMetrics(content: string) {
  const stats = readingTime(content);
  const toc = extractToc(content);
  return {
    readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
    wordCount: stats.words,
    headingCount: toc.length,
    headings: toc,
  };
}

export const SCIENTA_MDX_GUIDE = {
  formattingNotes: [
    "Use ## and ### headings so Scienta automatically builds the Table of Contents and Reading Progress anchors.",
    "Inline math uses $...$ and display equations use $$...$$ (automatically enhanced into interactive Equation Explorer cards).",
    "Do NOT include raw <script>, <iframe>, or event handlers (onclick, onerror, etc.); use the declarative components below.",
  ],
  components: [
    {
      name: "StatHighlight",
      description: "Animated numeric KPI badge strip for key experimental metrics or constants.",
      example: `<StatHighlight stats={[{ value: "99.94%", label: "Two-qubit gate fidelity at 15 mK" }]} />`,
    },
    {
      name: "Callout",
      description: "Editorial callout box. type: info | warning | tip",
      example: `<Callout type="tip" title="Key Physical Intuition">\n  Spacetime curvature dictates geodesic deviation...\n</Callout>`,
    },
    {
      name: "Theorem",
      description: "Formal theorem, Lemma, Corollary, or Proof block supporting LaTeX inside.",
      example: `<Theorem title="Noether's First Theorem">\n  Every differentiable symmetry of the action corresponds to a conservation law.\n</Theorem>`,
    },
    {
      name: "Figure",
      description: "High-resolution figure with caption (prefer path returned by POST /api/v1/media).",
      example: `<Figure src="/uploads/media/example.png" alt="Quantum processor cryostat" caption="Dilution refrigerator stage at 15 mK." />`,
    },
    {
      name: "Timeline",
      description: "Chronological milestone cards for scientific history or experimental steps.",
      example: `<Timeline events={[{ year: "1915", title: "General Relativity", description: "Einstein field equations published." }]} />`,
    },
    {
      name: "ComparisonCards",
      description: "Side-by-side comparison grid for methods, models, or architectures.",
      example: `<ComparisonCards columns={[{ title: "Schwarzschild", rows: ["Static, spherically symmetric"] }, { title: "Kerr", highlight: true, rows: ["Rotating, frame-dragging ergosphere"] }]} />`,
    },
    {
      name: "PullQuote",
      description: "Highlighted scientific quote with attribution.",
      example: `<PullQuote attribution="Richard Feynman">Nature isn't classical, dammit.</PullQuote>`,
    },
    {
      name: "Mermaid",
      description: "Declarative architecture / causal / experimental flow diagram.",
      example: "<Mermaid chart={`graph LR\n  A[Laser Pulse] --> B[Cavity QED]\n  B --> C[Entangled Photon Pair]`} />",
    },
  ],
};

export function generateOpenApiSpec(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return {
    openapi: "3.1.0",
    info: {
      title: "Scienta AI Publishing & Automation API",
      version: "1.0.0",
      description:
        "Production REST API enabling AI agents (ChatGPT Actions, Claude/MCP, Gemini, n8n, LangChain, Python/Node pipelines) to inspect Scienta's bilingual taxonomy, upload verified images (multipart, base64, or HTTPS URL), and draft, validate (dryRun), update, or publish scientific MDX+LaTeX articles.",
      contact: {
        name: "Scienta Editorial Platform",
      },
    },
    servers: [{ url: cleanBase, description: "Active Scienta Instance" }],
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    tags: [
      { name: "Discovery", description: "Inspect authenticated API key, scopes, taxonomy, and Scienta MDX guides" },
      { name: "Media", description: "Upload images (multipart, base64, or safe HTTPS URL) and generate thumbnails" },
      { name: "Articles", description: "Create, validate (dryRun), list, update, publish, or trash bilingual MDX articles" },
    ],
    paths: {
      "/api/v1/me": {
        get: {
          tags: ["Discovery"],
          operationId: "getApiKeyIdentity",
          summary: "Verify API key identity, scopes, and rate-limit status",
          responses: {
            "200": { description: "Authenticated key profile and remaining per-minute quota" },
            "401": { description: "Invalid, missing, expired, or revoked API key" },
          },
        },
      },
      "/api/v1/schema": {
        get: {
          tags: ["Discovery"],
          operationId: "getPublishingGuide",
          summary: "Get live scientific fields, categories, authors, tags, and interactive MDX component specs",
          responses: {
            "200": { description: "Live taxonomy + MDX authoring rules for AI writers" },
          },
        },
      },
      "/api/v1/taxonomy": {
        get: {
          tags: ["Discovery"],
          operationId: "listTaxonomy",
          summary: "List all scientific fields, categories, authors, and tags",
          responses: {
            "200": { description: "Complete taxonomy directory" },
          },
        },
      },
      "/api/v1/taxonomy/tags": {
        post: {
          tags: ["Discovery"],
          operationId: "createTag",
          summary: "Create a bilingual tag (requires taxonomy:write scope)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nameEn", "nameFa"],
                  properties: {
                    slug: { type: "string", example: "quantum-optics" },
                    nameEn: { type: "string", example: "Quantum Optics" },
                    nameFa: { type: "string", example: "اپتیک کوانتومی" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Tag created" },
            "200": { description: "Existing tag returned" },
          },
        },
      },
      "/api/v1/media": {
        get: {
          tags: ["Media"],
          operationId: "listMedia",
          summary: "List media assets uploaded to Scienta",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "pageSize", in: "query", schema: { type: "integer", default: 30, maximum: 60 } },
          ],
          responses: {
            "200": { description: "Paginated media assets" },
          },
        },
        post: {
          tags: ["Media"],
          operationId: "uploadMedia",
          summary: "Upload an image via multipart/form-data, base64 JSON, or verified HTTPS imageUrl",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    imageUrl: { type: "string", format: "uri", description: "Public HTTPS URL of PNG/JPEG/WebP/GIF image (SSRF-verified)" },
                    imageBase64: { type: "string", description: "Raw base64 or data:image/...;base64,... string" },
                    filename: { type: "string", example: "blackhole-render.png" },
                    altText: { type: "string", example: "Relativistic accretion disk simulation" },
                  },
                },
              },
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    altText: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Image validated, re-encoded, thumbnailed, and stored cleanly" },
            "400": { description: "Invalid binary format, oversize (>8MB), or blocked URL" },
          },
        },
      },
      "/api/v1/articles": {
        get: {
          tags: ["Articles"],
          operationId: "listArticles",
          summary: "List articles filtered by status, field slug, or search query",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "scheduled"] } },
            { name: "field", in: "query", schema: { type: "string" } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "pageSize", in: "query", schema: { type: "integer", default: 20, maximum: 50 } },
          ],
          responses: { "200": { description: "Paginated list of articles" } },
        },
        post: {
          tags: ["Articles"],
          operationId: "createArticle",
          summary: "Upload, draft, dry-run validate, or publish a bilingual MDX scientific article",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              schema: { type: "string" },
              description: "Unique request key (valid 24h) preventing duplicate creation on AI retries.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateArticleRequest" },
              },
            },
          },
          responses: {
            "201": { description: "Article created with live bilingual URLs, ETag header, and metrics" },
            "200": { description: "Dry-run validation result (MDX compiled, no DB writes) or Idempotency-Key replay" },
            "400": { description: "Validation or taxonomy error (includes actionable hint)" },
            "403": { description: "Insufficient scope (e.g., articles:publish needed for status='published')" },
            "409": { description: "Slug conflict (use conflictStrategy='suffix' to auto-suffix) or Idempotency-Key mismatch" },
            "413": { description: "Request payload exceeds 1 MB limit" },
            "422": { description: "MDX compile error (exact line/column and self-healing hint returned before DB write)" },
          },
        },
      },
      "/api/v1/articles/{idOrSlug}": {
        get: {
          tags: ["Articles"],
          operationId: "getArticle",
          summary: "Get full article details, ETag header, and bilingual MDX content by UUID or slug",
          parameters: [{ name: "idOrSlug", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Full article object with ETag header" }, "404": { description: "Article not found" } },
        },
        patch: {
          tags: ["Articles"],
          operationId: "updateArticle",
          summary: "Partially update article metadata, status, cover, tags, or fa/en translations (supports If-Match optimistic locking and auto-saves revision history)",
          parameters: [
            { name: "idOrSlug", in: "path", required: true, schema: { type: "string" } },
            {
              name: "If-Match",
              in: "header",
              required: false,
              schema: { type: "string" },
              description: "Optional ETag from GET /api/v1/articles/{idOrSlug} to prevent lost updates (returns 412 if stale).",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PatchArticleRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Article updated, fresh ETag returned, and revision recorded" },
            "412": { description: "Precondition failed — article was modified since your If-Match ETag" },
            "413": { description: "Request payload exceeds 1 MB limit" },
            "422": { description: "MDX compile error (exact line/column returned before saving)" },
          },
        },
        delete: {
          tags: ["Articles"],
          operationId: "trashArticle",
          summary: "Move article safely to Recycle Bin (soft delete)",
          parameters: [{ name: "idOrSlug", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Article moved to trash" } },
        },
      },
      "/api/v1/articles/{idOrSlug}/revisions": {
        get: {
          tags: ["Articles"],
          operationId: "listArticleRevisions",
          summary: "List saved revision history snapshots for an article",
          parameters: [
            { name: "idOrSlug", in: "path", required: true, schema: { type: "string" } },
            { name: "includeContent", in: "query", schema: { type: "boolean", default: false } },
          ],
          responses: { "200": { description: "List of revision snapshots newest-first" }, "404": { description: "Article not found" } },
        },
        post: {
          tags: ["Articles"],
          operationId: "restoreArticleRevision",
          summary: "Restore a previous revision snapshot (automatically backs up current version first)",
          parameters: [{ name: "idOrSlug", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["revisionId"],
                  properties: {
                    revisionId: { type: "string", format: "uuid" },
                    note: { type: "string", maxLength: 200 },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Revision restored cleanly and pre-restore backup recorded" },
            "404": { description: "Article or revision not found" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API Key (sci_live_...)" },
        ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
      schemas: {
        TranslationPayload: {
          type: "object",
          required: ["title", "content"],
          properties: {
            title: { type: "string", minLength: 3, maxLength: 255 },
            slug: { type: "string", description: "Auto-generated from title if omitted" },
            excerpt: { type: "string", maxLength: 500 },
            content: { type: "string", description: "MDX source supporting KaTeX ($..$, $$..$$) and Scienta MDX components" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
            seoKeywords: { type: "string" },
            canonicalUrl: { type: "string", format: "uri" },
            twitterCard: { type: "string", enum: ["summary", "summary_large_image"] },
          },
        },
        CreateArticleRequest: {
          type: "object",
          properties: {
            field: { type: "string", example: "physics", description: "Scientific field slug (alternative to fieldId)" },
            fieldId: { type: "string", format: "uuid" },
            category: { type: "string", example: "deep-dive", description: "Category slug (alternative to categoryId)" },
            categoryId: { type: "string", format: "uuid" },
            author: { type: "string", example: "sara-ahmadi", description: "Author slug (defaults to key's defaultAuthor if configured)" },
            authorId: { type: "string", format: "uuid" },
            coverMediaId: { type: "string", format: "uuid" },
            coverMediaUrl: { type: "string", description: "Existing /uploads/... path OR public HTTPS image URL to auto-ingest" },
            coverAltText: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tag slugs/names (auto-created when autoCreateTags=true and taxonomy:write granted)",
            },
            autoCreateTags: { type: "boolean", default: true },
            status: { type: "string", enum: ["draft", "published", "scheduled"], default: "draft" },
            featured: { type: "boolean", default: false },
            trending: { type: "boolean", default: false },
            scheduledAt: { type: "string", format: "date-time", nullable: true },
            dryRun: { type: "boolean", default: false, description: "Compile-check MDX, slugs, and taxonomy without saving" },
            mirrorMissingLocale: { type: "boolean", default: true, description: "Mirror single-locale input into the other locale" },
            conflictStrategy: {
              type: "string",
              enum: ["error", "suffix"],
              default: "error",
              description: "Use 'suffix' to auto-append -2, -3 when a slug already exists instead of returning 409.",
            },
            translations: {
              type: "object",
              properties: {
                fa: { $ref: "#/components/schemas/TranslationPayload" },
                en: { $ref: "#/components/schemas/TranslationPayload" },
              },
            },
          },
        },
        PatchArticleRequest: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["draft", "published", "scheduled"] },
            featured: { type: "boolean" },
            trending: { type: "boolean" },
            field: { type: "string" },
            category: { type: "string" },
            author: { type: "string" },
            coverMediaId: { type: "string", format: "uuid" },
            coverMediaUrl: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            revisionNote: { type: "string", example: "AI Agent updated Equation 3 derivation" },
            translations: {
              type: "object",
              properties: {
                fa: { $ref: "#/components/schemas/TranslationPayload" },
                en: { $ref: "#/components/schemas/TranslationPayload" },
              },
            },
          },
        },
      },
    },
    "x-scienta-scopes": Object.fromEntries(SCOPE_CATALOG.map((s) => [s.scope, s.description])),
    "x-scienta-available-scopes": API_SCOPES,
    "x-scienta-mcp-endpoint": `${cleanBase}/api/v1/mcp`,
  };
}

export function buildRevisionSnapshotNote(keyName: string, note?: string) {
  const suffix = note?.trim() ? `: ${note.trim()}` : "";
  return `[AI API: ${keyName}]${suffix}`.slice(0, 255);
}

export async function recordArticleRevisions(
  conn: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
  articleId: string,
  translations: Array<{ locale: string; title: string; content: string }>,
  editorUserId: string,
  note: string
) {
  for (const current of translations) {
    await conn.execute(
      `INSERT INTO article_revisions (id, article_id, locale, title, content, editor_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), articleId, current.locale, current.title, current.content, editorUserId, note]
    );
  }
}
