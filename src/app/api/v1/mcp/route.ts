import { NextResponse } from "next/server";
import {
  authenticateV1Request,
  getPublicOrigin,
  hasScope,
  readTextBodyWithLimit,
  v1CorsPreflight,
  v1Headers,
  type ApiScope,
} from "@/lib/ai-api-auth";
import { generateOpenApiSpec, SCIENTA_MDX_GUIDE } from "@/lib/ai-api-articles";
import { GET as taxonomyGet } from "@/app/api/v1/taxonomy/route";
import { GET as schemaGet } from "@/app/api/v1/schema/route";
import { POST as mediaPost } from "@/app/api/v1/media/route";
import { GET as articlesGet, POST as articlesPost } from "@/app/api/v1/articles/route";
import { GET as articleGet, PATCH as articlePatch } from "@/app/api/v1/articles/[idOrSlug]/route";
import { GET as revisionsGet, POST as revisionsPost } from "@/app/api/v1/articles/[idOrSlug]/revisions/route";

export async function OPTIONS() {
  return v1CorsPreflight();
}

const MCP_PROTOCOL_VERSION = "2025-03-26";

interface McpToolDef {
  name: string;
  description: string;
  requiredScope: ApiScope;
  inputSchema: Record<string, unknown>;
}

const MCP_TOOLS: McpToolDef[] = [
  {
    name: "scienta_get_taxonomy",
    description:
      "Fetch Scienta's live scientific fields, categories, authors, and tags. Always call this before creating an article to use valid slugs.",
    requiredScope: "taxonomy:read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "scienta_get_mdx_guide",
    description:
      "Retrieve Scienta's MDX authoring rules, KaTeX math conventions, and interactive component schemas (<StatHighlight>, <Callout>, <Theorem>, <Figure>, <Timeline>, <ComparisonCards>, <PullQuote>, <Mermaid>).",
    requiredScope: "taxonomy:read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "scienta_list_articles",
    description: "List existing Scienta articles filtered by status, field slug, or search query.",
    requiredScope: "articles:read",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "published", "scheduled"] },
        field: { type: "string" },
        search: { type: "string" },
        page: { type: "integer", minimum: 1 },
        pageSize: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "scienta_get_article",
    description: "Fetch a full bilingual article including MDX source, metadata, and ETag by UUID or slug.",
    requiredScope: "articles:read",
    inputSchema: {
      type: "object",
      required: ["idOrSlug"],
      properties: {
        idOrSlug: { type: "string", description: "Article UUID or FA/EN slug" },
      },
    },
  },
  {
    name: "scienta_upload_media",
    description:
      "Upload an image into Scienta's verified media library from a public HTTPS URL or base64 payload (magic-byte verified, re-encoded, thumbnailed).",
    requiredScope: "media:write",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", description: "Public HTTPS URL of PNG/JPEG/WebP/GIF image" },
        imageBase64: { type: "string", description: "Raw base64 or data:image/...;base64,... image" },
        filename: { type: "string" },
        altText: { type: "string" },
      },
    },
  },
  {
    name: "scienta_validate_article",
    description:
      "Dry-run validate a bilingual MDX article (runs real compileMDX check, security scan, editorial quality lint, taxonomy lookup, and slug conflict check WITHOUT writing to the database).",
    requiredScope: "articles:write",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string" },
        category: { type: "string" },
        author: { type: "string" },
        status: { type: "string", enum: ["draft", "published", "scheduled"] },
        tags: { type: "array", items: { type: "string" } },
        coverMediaId: { type: "string" },
        coverMediaUrl: { type: "string" },
        conflictStrategy: { type: "string", enum: ["error", "suffix"] },
        translations: {
          type: "object",
          properties: {
            fa: {
              type: "object",
              required: ["title", "content"],
              properties: {
                title: { type: "string" },
                slug: { type: "string" },
                excerpt: { type: "string" },
                content: { type: "string" },
              },
            },
            en: {
              type: "object",
              required: ["title", "content"],
              properties: {
                title: { type: "string" },
                slug: { type: "string" },
                excerpt: { type: "string" },
                content: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "scienta_create_article",
    description:
      "Create, draft, schedule, or publish a bilingual MDX+LaTeX scientific article. Supports optional idempotencyKey and conflictStrategy ('error' or 'suffix').",
    requiredScope: "articles:write",
    inputSchema: {
      type: "object",
      properties: {
        idempotencyKey: { type: "string", description: "Unique UUID preventing duplicate creation on retries" },
        field: { type: "string" },
        category: { type: "string" },
        author: { type: "string" },
        status: { type: "string", enum: ["draft", "published", "scheduled"] },
        featured: { type: "boolean" },
        trending: { type: "boolean" },
        scheduledAt: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        coverMediaId: { type: "string" },
        coverMediaUrl: { type: "string" },
        coverAltText: { type: "string" },
        conflictStrategy: { type: "string", enum: ["error", "suffix"] },
        mirrorMissingLocale: { type: "boolean" },
        translations: {
          type: "object",
          properties: {
            fa: {
              type: "object",
              required: ["title", "content"],
              properties: {
                title: { type: "string" },
                slug: { type: "string" },
                excerpt: { type: "string" },
                content: { type: "string" },
                seoTitle: { type: "string" },
                seoDescription: { type: "string" },
              },
            },
            en: {
              type: "object",
              required: ["title", "content"],
              properties: {
                title: { type: "string" },
                slug: { type: "string" },
                excerpt: { type: "string" },
                content: { type: "string" },
                seoTitle: { type: "string" },
                seoDescription: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "scienta_update_article",
    description:
      "Partially update an existing article's metadata, status, tags, cover, or FA/EN translations. Automatically records a revision snapshot and supports optimistic locking via ifMatch (ETag).",
    requiredScope: "articles:write",
    inputSchema: {
      type: "object",
      required: ["idOrSlug"],
      properties: {
        idOrSlug: { type: "string" },
        ifMatch: { type: "string", description: "Optional ETag from scienta_get_article for optimistic concurrency" },
        status: { type: "string", enum: ["draft", "published", "scheduled"] },
        featured: { type: "boolean" },
        trending: { type: "boolean" },
        field: { type: "string" },
        category: { type: "string" },
        author: { type: "string" },
        coverMediaId: { type: "string" },
        coverMediaUrl: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        revisionNote: { type: "string" },
        translations: { type: "object" },
      },
    },
  },
  {
    name: "scienta_list_revisions",
    description: "List saved revision snapshots for an article.",
    requiredScope: "articles:read",
    inputSchema: {
      type: "object",
      required: ["idOrSlug"],
      properties: {
        idOrSlug: { type: "string" },
        includeContent: { type: "boolean" },
        locale: { type: "string", enum: ["fa", "en"] },
      },
    },
  },
  {
    name: "scienta_restore_revision",
    description: "Rollback an article locale to a specific historical revisionId (automatically backs up current state first).",
    requiredScope: "articles:write",
    inputSchema: {
      type: "object",
      required: ["idOrSlug", "revisionId"],
      properties: {
        idOrSlug: { type: "string" },
        revisionId: { type: "string" },
        note: { type: "string" },
      },
    },
  },
];

function jsonRpcResult(
  id: string | number | null,
  result: unknown,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, result },
    { status: 200, headers: v1Headers(extraHeaders) }
  );
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    },
    { status: 200, headers: v1Headers(extraHeaders) }
  );
}

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return NextResponse.json(
    {
      name: "scienta-publishing-mcp",
      version: "1.1.0",
      protocol: "Model Context Protocol (Streamable HTTP / JSON-RPC 2.0)",
      protocolVersion: MCP_PROTOCOL_VERSION,
      endpoint: `${origin}/api/v1/mcp`,
      authentication: "Authorization: Bearer sci_live_... (or X-API-Key header)",
      openApiSpec: `${origin}/api/v1/openapi.json`,
      toolCount: MCP_TOOLS.length,
    },
    { status: 200, headers: v1Headers() }
  );
}

export async function POST(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return auth.response;

  const bodyRead = await readTextBodyWithLimit(req, 1_048_576);
  if (!bodyRead.ok) {
    return jsonRpcError(null, -32600, "Request body exceeds 1 MB limit.", undefined, auth.rateHeaders);
  }

  let rpc: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try {
    rpc = JSON.parse(bodyRead.text);
  } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON-RPC 2.0 body.", undefined, auth.rateHeaders);
  }

  if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return jsonRpcError(
      rpc?.id ?? null,
      -32600,
      "Invalid Request: expected JSON-RPC 2.0 object with `method`.",
      undefined,
      auth.rateHeaders
    );
  }

  const id = rpc.id ?? null;
  const origin = getPublicOrigin(req);
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const baseHeaders: Record<string, string> = {};
  if (authHeader) baseHeaders["Authorization"] = authHeader;
  if (apiKeyHeader) baseHeaders["X-API-Key"] = apiKeyHeader;

  // Notifications without an id require 202 Accepted with empty body per MCP Streamable HTTP spec
  if (rpc.method.startsWith("notifications/") && rpc.id === undefined) {
    return new NextResponse(null, { status: 202, headers: v1Headers(auth.rateHeaders) });
  }

  if (rpc.method === "ping") {
    return jsonRpcResult(id, {}, auth.rateHeaders);
  }

  if (rpc.method === "initialize") {
    return jsonRpcResult(
      id,
      {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: {
          name: "scienta-publishing-mcp",
          version: "1.1.0",
        },
        instructions:
          "Scienta bilingual scientific publishing server. Call scienta_get_taxonomy first for valid field/category/author slugs, use scienta_validate_article to compile-check MDX before publishing, and pass idempotencyKey when creating articles.",
      },
      auth.rateHeaders
    );
  }

  if (rpc.method === "resources/list") {
    return jsonRpcResult(
      id,
      {
        resources: [
          {
            uri: "scienta://taxonomy",
            name: "Scienta Scientific Taxonomy",
            description: "Live scientific fields, categories, authors, and tags.",
            mimeType: "application/json",
          },
          {
            uri: "scienta://mdx-guide",
            name: "Scienta MDX & KaTeX Authoring Guide",
            description: "Interactive scientific MDX component specs and formatting rules.",
            mimeType: "application/json",
          },
          {
            uri: "scienta://openapi",
            name: "Scienta OpenAPI 3.1 Specification",
            description: "Complete REST OpenAPI 3.1 schema for /api/v1/*.",
            mimeType: "application/json",
          },
        ],
      },
      auth.rateHeaders
    );
  }

  if (rpc.method === "resources/read") {
    const uri = typeof rpc.params?.uri === "string" ? rpc.params.uri : "";
    if (uri === "scienta://mdx-guide") {
      return jsonRpcResult(
        id,
        {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(SCIENTA_MDX_GUIDE, null, 2),
            },
          ],
        },
        auth.rateHeaders
      );
    }
    if (uri === "scienta://openapi") {
      return jsonRpcResult(
        id,
        {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(generateOpenApiSpec(origin), null, 2),
            },
          ],
        },
        auth.rateHeaders
      );
    }
    if (uri === "scienta://taxonomy") {
      const subReq = new Request(`${origin}/api/v1/taxonomy`, { method: "GET", headers: baseHeaders });
      const res = await taxonomyGet(subReq);
      const text = await res.text();
      if (!res.ok) {
        return jsonRpcError(id, -32001, `Failed to read taxonomy (HTTP ${res.status})`, text, auth.rateHeaders);
      }
      return jsonRpcResult(
        id,
        { contents: [{ uri, mimeType: "application/json", text }] },
        auth.rateHeaders
      );
    }
    return jsonRpcError(id, -32602, `Unknown resource URI '${uri}'.`, undefined, auth.rateHeaders);
  }

  if (rpc.method === "tools/list") {
    const visibleTools = MCP_TOOLS.filter((t) => hasScope(auth.key.scopes, t.requiredScope)).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    return jsonRpcResult(id, { tools: visibleTools }, auth.rateHeaders);
  }

  if (rpc.method === "tools/call") {
    const toolName = typeof rpc.params?.name === "string" ? rpc.params.name : "";
    const args =
      rpc.params?.arguments && typeof rpc.params.arguments === "object"
        ? (rpc.params.arguments as Record<string, unknown>)
        : {};

    const toolDef = MCP_TOOLS.find((t) => t.name === toolName);
    if (!toolDef) {
      return jsonRpcError(id, -32602, `Unknown tool '${toolName}'.`, undefined, auth.rateHeaders);
    }
    if (!hasScope(auth.key.scopes, toolDef.requiredScope)) {
      return jsonRpcResult(
        id,
        {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "insufficient_scope",
                message: `API key '${auth.key.name}' lacks required scope '${toolDef.requiredScope}' for tool '${toolName}'.`,
              }),
            },
          ],
        },
        auth.rateHeaders
      );
    }

    let response: Response;
    try {
      switch (toolName) {
        case "scienta_get_taxonomy": {
          response = await taxonomyGet(new Request(`${origin}/api/v1/taxonomy`, { method: "GET", headers: baseHeaders }));
          break;
        }
        case "scienta_get_mdx_guide": {
          response = await schemaGet(new Request(`${origin}/api/v1/schema`, { method: "GET", headers: baseHeaders }));
          break;
        }
        case "scienta_list_articles": {
          const qs = new URLSearchParams();
          for (const k of ["status", "field", "search", "page", "pageSize"]) {
            if (args[k] !== undefined && args[k] !== null) qs.set(k, String(args[k]));
          }
          response = await articlesGet(
            new Request(`${origin}/api/v1/articles${qs.toString() ? `?${qs.toString()}` : ""}`, {
              method: "GET",
              headers: baseHeaders,
            })
          );
          break;
        }
        case "scienta_get_article": {
          const idOrSlug = String(args.idOrSlug ?? "").trim();
          response = await articleGet(
            new Request(`${origin}/api/v1/articles/${encodeURIComponent(idOrSlug)}`, {
              method: "GET",
              headers: baseHeaders,
            }),
            { params: Promise.resolve({ idOrSlug }) }
          );
          break;
        }
        case "scienta_upload_media": {
          response = await mediaPost(
            new Request(`${origin}/api/v1/media`, {
              method: "POST",
              headers: { ...baseHeaders, "Content-Type": "application/json" },
              body: JSON.stringify(args),
            })
          );
          break;
        }
        case "scienta_validate_article": {
          response = await articlesPost(
            new Request(`${origin}/api/v1/articles`, {
              method: "POST",
              headers: { ...baseHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ ...args, dryRun: true }),
            })
          );
          break;
        }
        case "scienta_create_article": {
          const { idempotencyKey, ...rest } = args;
          const headers: Record<string, string> = {
            ...baseHeaders,
            "Content-Type": "application/json",
          };
          if (typeof idempotencyKey === "string" && idempotencyKey.trim()) {
            headers["Idempotency-Key"] = idempotencyKey.trim();
          }
          response = await articlesPost(
            new Request(`${origin}/api/v1/articles`, {
              method: "POST",
              headers,
              body: JSON.stringify({ ...rest, dryRun: false }),
            })
          );
          break;
        }
        case "scienta_update_article": {
          const { idOrSlug, ifMatch, ...patchPayload } = args;
          const target = String(idOrSlug ?? "").trim();
          const headers: Record<string, string> = {
            ...baseHeaders,
            "Content-Type": "application/json",
          };
          if (typeof ifMatch === "string" && ifMatch.trim()) {
            headers["If-Match"] = ifMatch.trim();
          }
          response = await articlePatch(
            new Request(`${origin}/api/v1/articles/${encodeURIComponent(target)}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(patchPayload),
            }),
            { params: Promise.resolve({ idOrSlug: target }) }
          );
          break;
        }
        case "scienta_list_revisions": {
          const target = String(args.idOrSlug ?? "").trim();
          const qs = new URLSearchParams();
          if (args.includeContent) qs.set("includeContent", "1");
          if (typeof args.locale === "string") qs.set("locale", args.locale);
          response = await revisionsGet(
            new Request(
              `${origin}/api/v1/articles/${encodeURIComponent(target)}/revisions${qs.toString() ? `?${qs.toString()}` : ""}`,
              { method: "GET", headers: baseHeaders }
            ),
            { params: Promise.resolve({ idOrSlug: target }) }
          );
          break;
        }
        case "scienta_restore_revision": {
          const target = String(args.idOrSlug ?? "").trim();
          response = await revisionsPost(
            new Request(`${origin}/api/v1/articles/${encodeURIComponent(target)}/revisions`, {
              method: "POST",
              headers: { ...baseHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ revisionId: args.revisionId, note: args.note }),
            }),
            { params: Promise.resolve({ idOrSlug: target }) }
          );
          break;
        }
        default:
          return jsonRpcError(id, -32601, `Tool '${toolName}' is not implemented.`, undefined, auth.rateHeaders);
      }
    } catch (err) {
      return jsonRpcResult(
        id,
        {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "tool_execution_failed",
                message: err instanceof Error ? err.message : "Internal tool execution failure",
              }),
            },
          ],
        },
        auth.rateHeaders
      );
    }

    const text = await response.text();
    return jsonRpcResult(
      id,
      {
        isError: !response.ok,
        content: [{ type: "text", text }],
      },
      auth.rateHeaders
    );
  }

  return jsonRpcError(id, -32601, `Method '${rpc.method}' not found.`, undefined, auth.rateHeaders);
}
