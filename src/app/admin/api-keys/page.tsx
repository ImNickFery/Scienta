"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Ban,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  Terminal,
  Sparkles,
  Play,
  ExternalLink,
  X,
  Pencil,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { copyToClipboard } from "@/lib/clipboard";
import type { ApiScope, ScopeDescriptor } from "@/lib/ai-api-auth";

interface ApiKeyItem {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  scopes: ApiScope[];
  ownerUserId: string;
  ownerName: string | null;
  defaultAuthorId: string | null;
  defaultAuthorName: string | null;
  rateLimitPerMin: number;
  status: "active" | "revoked";
  requestCount: number;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface AuthorOption {
  id: string;
  slug: string;
  name_en: string;
  name_fa: string;
}

interface PresetMap {
  [key: string]: {
    label: string;
    scopes: ApiScope[];
  };
}

const DEFAULT_SCOPES: ApiScope[] = [
  "taxonomy:read",
  "taxonomy:write",
  "media:read",
  "media:write",
  "articles:read",
  "articles:write",
];

type SnippetTab = "mcp" | "gpt" | "curl" | "python" | "node";

export default function AdminApiKeysPage() {
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [scopeCatalog, setScopeCatalog] = useState<ScopeDescriptor[]>([]);
  const [scopePresets, setScopePresets] = useState<PresetMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultAuthorId, setDefaultAuthorId] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>(DEFAULT_SCOPES);
  const [rateLimitPerMin, setRateLimitPerMin] = useState(60);
  const [expiresInDays, setExpiresInDays] = useState<string>("");

  // Edit existing key state
  const [editingKey, setEditingKey] = useState<ApiKeyItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAuthorId, setEditAuthorId] = useState("");
  const [editScopes, setEditScopes] = useState<ApiScope[]>([]);
  const [editRateLimit, setEditRateLimit] = useState(60);

  const [revealedToken, setRevealedToken] = useState<{ name: string; token: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: "rotate" | "delete" } | null>(null);

  const [origin, setOrigin] = useState("https://your-scienta-site.com");
  const [activeTab, setActiveTab] = useState<SnippetTab>("mcp");

  // Live Playground state
  const [testToken, setTestToken] = useState("");
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    status: number;
    endpoint: string;
    rateLimit?: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync client origin after mount to prevent hydration mismatch
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<{
        items: ApiKeyItem[];
        authors: AuthorOption[];
        scopeCatalog: ScopeDescriptor[];
        scopePresets: PresetMap;
      }>("/api/admin/api-keys");
      setItems(data.items);
      setAuthors(data.authors);
      setScopeCatalog(data.scopeCatalog);
      setScopePresets(data.scopePresets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial API keys fetch on mount
    load();
  }, [load]);

  async function handleCopy(text: string, id: string) {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    }
  }

  function toggleScope(scope: ApiScope) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selectedScopes.length === 0) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch<{
        id: string;
        name: string;
        plaintextToken: string;
      }>("/api/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          scopes: selectedScopes,
          defaultAuthorId: defaultAuthorId || null,
          rateLimitPerMin,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        }),
      });
      setRevealedToken({ name: res.name, token: res.plaintextToken });
      setTestToken(res.plaintextToken);
      setName("");
      setDescription("");
      setShowCreate(false);
      setNotice("API key created. Copy the plaintext token below now — it will never be displayed again.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(item: ApiKeyItem) {
    setSubmitting(true);
    setError(null);
    try {
      const action = item.status === "active" ? "revoke" : "activate";
      await adminFetch(`/api/admin/api-keys/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setNotice(action === "revoke" ? `Revoked key "${item.name}".` : `Reactivated key "${item.name}".`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update key status");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotate(item: ApiKeyItem) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminFetch<{ plaintextToken: string }>(`/api/admin/api-keys/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "rotate" }),
      });
      setRevealedToken({ name: `${item.name} (Rotated)`, token: res.plaintextToken });
      setTestToken(res.plaintextToken);
      setConfirmAction(null);
      setNotice(`Rotated "${item.name}". Old token is immediately invalid.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate key");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: ApiKeyItem) {
    setShowCreate(false);
    setConfirmAction(null);
    setEditingKey(item);
    setEditName(item.name);
    setEditDesc(item.description ?? "");
    setEditAuthorId(item.defaultAuthorId ?? "");
    setEditScopes(item.scopes);
    setEditRateLimit(item.rateLimitPerMin);
    setError(null);
  }

  function toggleEditScope(scope: ApiScope) {
    setEditScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingKey || !editName.trim() || editScopes.length === 0) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/api-keys/${editingKey.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update",
          name: editName.trim(),
          description: editDesc.trim(),
          defaultAuthorId: editAuthorId || null,
          scopes: editScopes,
          rateLimitPerMin: editRateLimit,
        }),
      });
      setNotice(`Updated API key "${editName.trim()}".`);
      setEditingKey(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update API key");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: ApiKeyItem) {
    setSubmitting(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/api-keys/${item.id}`, { method: "DELETE" });
      setConfirmAction(null);
      setNotice(`Deleted API key "${item.name}".`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    } finally {
      setSubmitting(false);
    }
  }

  async function runPlaygroundTest(mode: "me" | "taxonomy" | "dryrun" | "mcp") {
    if (!testToken.trim()) {
      setError("Paste an active sci_live_... token in the Live Sandbox field first.");
      return;
    }
    setError(null);
    setTestingEndpoint(mode);
    try {
      let url = "/api/v1/me";
      let init: RequestInit = {
        method: "GET",
        headers: { Authorization: `Bearer ${testToken.trim()}` },
      };

      if (mode === "taxonomy") {
        url = "/api/v1/taxonomy";
      } else if (mode === "dryrun") {
        url = "/api/v1/articles";
        init = {
          method: "POST",
          headers: {
            Authorization: `Bearer ${testToken.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dryRun: true,
            status: "draft",
            field: "physics",
            tags: ["ai-test", "quantum-optics"],
            translations: {
              en: {
                title: "Sandbox Quantum Verification Article",
                slug: `sandbox-quantum-${Date.now()}`,
                excerpt: "Automated dry-run validation check.",
                content:
                  "## Overview\n\nEnergy quantization satisfies $E_n = \\hbar\\omega(n + 1/2)$.\n\n<Callout variant=\"insight\" title=\"Validated\">Zero-point energy check.</Callout>",
              },
              fa: {
                title: "مقاله آزمایشی راستی‌آزمایی کوانتومی",
                slug: `sandbox-quantum-${Date.now()}`,
                excerpt: "بررسی خودکار در حالت آزمایشی بدون ذخیره در پایگاه داده.",
                content:
                  "## مرور کلی\n\nکوانتش انرژی از رابطه $E_n = \\hbar\\omega(n + 1/2)$ پیروی می‌کند.",
              },
            },
          }),
        };
      } else if (mode === "mcp") {
        url = "/api/v1/mcp";
        init = {
          method: "POST",
          headers: {
            Authorization: `Bearer ${testToken.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
            params: {},
          }),
        };
      }

      const res = await fetch(url, init);
      const text = await res.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // keep raw text
      }
      const limit = res.headers.get("X-RateLimit-Limit");
      const remaining = res.headers.get("X-RateLimit-Remaining");
      setTestResult({
        status: res.status,
        endpoint: `${init.method} ${url}`,
        rateLimit: limit ? `${remaining}/${limit} remaining this min` : undefined,
        body: formatted,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sandbox request failed");
    } finally {
      setTestingEndpoint(null);
    }
  }

  const openApiUrl = `${origin}/api/v1/openapi.json`;
  const mcpUrl = `${origin}/api/v1/mcp`;

  const snippets = useMemo<Record<SnippetTab, string>>(() => {
    const tokenPlaceholder = revealedToken?.token ?? "sci_live_YOUR_API_KEY";
    return {
      mcp: `// Claude Desktop, Cursor, Windsurf & Gemini CLI (Streamable HTTP MCP)
{
  "mcpServers": {
    "scienta": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${tokenPlaceholder}"
      }
    }
  }
}

// Available MCP Tools (scoped automatically to your API key):
// • scienta_get_taxonomy       • scienta_get_mdx_guide
// • scienta_list_articles      • scienta_get_article
// • scienta_upload_media       • scienta_validate_article (compileMDX check)
// • scienta_create_article     • scienta_update_article (If-Match ETag)
// • scienta_list_revisions     • scienta_restore_revision`,
      gpt: `OpenAPI 3.1 Import URL (for ChatGPT Actions, LangChain, n8n):
${openApiUrl}

Native MCP Server Endpoint (JSON-RPC 2.0 Streamable HTTP):
${mcpUrl}

Authentication Header:
  Type: API Key -> Bearer (Authorization: Bearer ${tokenPlaceholder})

Recommended System Prompt for your AI Writer Agent:
"You are an editorial scientist for Scienta.
1. Call getTaxonomy (/api/v1/taxonomy) first to pick a valid field slug, category slug, and author slug.
2. When you need images, call uploadMedia (/api/v1/media) with a public HTTPS imageUrl or base64 payload, or pass coverMediaUrl directly on article creation.
3. Write bilingual Persian (fa) + English (en) MDX articles using ## headings, KaTeX ($...$, $$...$$), and Scienta components (<StatHighlight>, <Theorem>, <Callout>, <Figure>).
4. Validate first with dryRun=true (compiles MDX and returns exact line/column on syntax errors), then publish with a unique Idempotency-Key header and conflictStrategy: 'suffix' if needed."`,
      curl: `curl -X POST "${origin}/api/v1/articles" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen || echo ai-run-001)" \\
  -d '{
    "field": "physics",
    "category": "deep-dive",
    "author": "sara-ahmadi",
    "status": "published",
    "tags": ["quantum-optics", "photonics"],
    "coverMediaUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/800px-Placeholder_view_vector.svg.png",
    "translations": {
      "en": {
        "title": "Squeezed Light Beyond the Shot-Noise Limit",
        "excerpt": "How quantum vacuum fluctuations are reshaped for gravitational-wave interferometry.",
        "content": "## Quantum Noise Floor\\n\\nBy squeezing phase uncertainty below the standard quantum limit:\\n\\n$$\\\\Delta X_1 \\\\Delta X_2 \\\\ge \\\\frac{1}{4}$$\\n\\n<StatHighlight stats={[{\\"value\\":\\"-15 dB\\",\\"label\\":\\"Noise Reduction\\"}]} />"
      },
      "fa": {
        "title": "نور فشرده فراتر از حد نویز شات",
        "excerpt": "چگونه نوسانات خلأ کوانتومی برای تداخل‌سنج‌های امواج گرانشی شکل‌دهی می‌شوند.",
        "content": "## کف نویز کوانتومی\\n\\nبا فشرده‌سازی عدم قطعیت فاز فراتر از حد استاندارد کوانتومی:\\n\\n$$\\\\Delta X_1 \\\\Delta X_2 \\\\ge \\\\frac{1}{4}$$"
      }
    }
  }'`,
      python: `import uuid, requests

BASE = "${origin}/api/v1"
HEADERS = {
    "Authorization": "Bearer ${tokenPlaceholder}",
    "Idempotency-Key": str(uuid.uuid4()),
}

# 1. Discover fields, categories & authors
taxonomy = requests.get(f"{BASE}/taxonomy", headers=HEADERS).json()

# 2. Validate with dryRun=True, then publish
payload = {
    "field": "ai",
    "category": "deep-dive",
    "status": "draft",
    "tags": ["mechanistic-interpretability"],
    "translations": {
        "en": {
            "title": "Sparse Autoencoders and Polysemanticity",
            "excerpt": "Decomposing superposed neural activations into interpretable features.",
            "content": "## Superposition Hypothesis\\n\\nDictionary learning recovers sparse monosemantic directions."
        }
    }
}
res = requests.post(f"{BASE}/articles", json=payload, headers=HEADERS)
print(res.status_code, res.json())`,
      node: `const res = await fetch("${origin}/api/v1/articles", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${tokenPlaceholder}",
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    field: "astronomy",
    category: "deep-dive",
    status: "published",
    tags: ["exoplanets", "jwst"],
    translations: {
      en: {
        title: "Atmospheric Spectroscopy of Hycean Exoplanets",
        excerpt: "Probing water-rich sub-Neptune atmospheres with JWST NIRSpec.",
        content: "## Transmission Spectra\\n\\nAbsorption depth scales with atmospheric scale height $H = k_B T / (\\\\mu g)$.",
      },
      fa: {
        title: "طیف‌سنجی جو سیارات فراخورشیدی هایسین",
        excerpt: "بررسی جوهای غنی از آب با طیف‌سنج NIRSpec تلسکوپ جیمز وب.",
        content: "## طیف عبوری\\n\\nعمق جذب متناسب با مقیاس ارتفاع جوی $H = k_B T / (\\\\mu g)$ تغییر می‌کند.",
      },
    },
  }),
});
console.log(await res.json());`,
    };
  }, [origin, openApiUrl, mcpUrl, revealedToken]);

  const activeCount = items.filter((k) => k.status === "active").length;
  const totalRequests = items.reduce((acc, k) => acc + (k.requestCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            AI &amp; External Publishing API
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">
            Connect ChatGPT Actions, Claude, Gemini agents, or n8n workflows to upload verified media and publish bilingual MDX articles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreate((v) => !v);
            setError(null);
          }}
          className="flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-sm font-medium text-white shadow-lg shadow-(--color-accent-purple)/20 transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          New API Key
        </button>
      </div>

      {/* Stats + OpenAPI + MCP Quick Bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-elevated rounded-2xl p-4">
          <p className="text-xs text-(--color-text-tertiary)">Active API Keys</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            {activeCount}
          </p>
        </div>
        <div className="card-elevated rounded-2xl p-4">
          <p className="text-xs text-(--color-text-tertiary)">Total AI API Requests</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            {totalRequests.toLocaleString()}
          </p>
        </div>
        <div className="card-elevated flex min-w-0 flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-(--color-text-tertiary)">OpenAPI 3.1 Spec</p>
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-(--color-accent-purple) hover:underline"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/30 px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs text-(--color-text-secondary)">
              {openApiUrl}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(openApiUrl, "openapi-url")}
              aria-label="Copy OpenAPI URL"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-(--color-border-subtle) text-(--color-text-secondary) hover:text-(--color-text-primary)"
            >
              {copiedId === "openapi-url" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="card-elevated flex min-w-0 flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-(--color-text-tertiary)">Native MCP Server</p>
            <a
              href="/api/v1/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-(--color-accent-orange) hover:underline"
            >
              Info <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/30 px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs text-(--color-text-secondary)">
              {mcpUrl}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(mcpUrl, "mcp-url")}
              aria-label="Copy MCP URL"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-(--color-border-subtle) text-(--color-text-secondary) hover:text-(--color-text-primary)"
            >
              {copiedId === "mcp-url" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-3 text-sm text-(--color-accent-red)">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {/* One-time Plaintext Token Reveal Banner */}
      {revealedToken && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <h2 className="text-sm font-semibold">
                Save your API Key now — {revealedToken.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setRevealedToken(null)}
              aria-label="Dismiss token banner"
              className="text-amber-200/70 hover:text-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-200/80">
            For security, Scienta stores only a SHA-256 hash of your key. Copy this token now before dismissing.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code
              data-testid="revealed-api-token"
              className="flex-1 overflow-x-auto rounded-xl border border-amber-400/30 bg-black/50 px-3.5 py-2.5 font-[family-name:var(--font-mono)] text-xs text-amber-200"
            >
              {revealedToken.token}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(revealedToken.token, "revealed-token")}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-xs font-semibold text-black hover:bg-amber-300"
            >
              {copiedId === "revealed-token" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedId === "revealed-token" ? "Copied" : "Copy Key"}
            </button>
          </div>
        </div>
      )}

      {/* Create Key Panel */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card-elevated space-y-5 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-(--color-accent-purple)" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">Create New AI API Key</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              aria-label="Close form"
              className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="key-name" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                Agent / Integration Name *
              </label>
              <input
                id="key-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Claude Science Editorial Agent"
                className="admin-input"
              />
            </div>

            <div>
              <label htmlFor="key-author" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                Default Author Byline (optional)
              </label>
              <select
                id="key-author"
                value={defaultAuthorId}
                onChange={(e) => setDefaultAuthorId(e.target.value)}
                className="admin-input"
              >
                <option value="">None (Agent specifies author slug)</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_en} ({a.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="key-desc" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                Description / Purpose
              </label>
              <input
                id="key-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Automated astrophysics & AI deep-dive pipeline"
                className="admin-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="key-rate" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                  Rate Limit / min
                </label>
                <select
                  id="key-rate"
                  value={rateLimitPerMin}
                  onChange={(e) => setRateLimitPerMin(Number(e.target.value))}
                  className="admin-input"
                >
                  <option value={30}>30 req/min</option>
                  <option value={60}>60 req/min</option>
                  <option value={120}>120 req/min</option>
                  <option value={300}>300 req/min</option>
                </select>
              </div>
              <div>
                <label htmlFor="key-expiry" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                  Expiration
                </label>
                <select
                  id="key-expiry"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="admin-input"
                >
                  <option value="">Never expires</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-(--color-text-secondary)">Permission Scopes</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(scopePresets).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedScopes(preset.scopes)}
                    className="rounded-full border border-(--color-border-subtle) px-3 py-1 text-[11px] text-(--color-text-secondary) hover:border-(--color-accent-purple)/60 hover:text-(--color-text-primary)"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {scopeCatalog.map((s) => {
                const checked = selectedScopes.includes(s.scope);
                return (
                  <label
                    key={s.scope}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                      checked
                        ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/10"
                        : "border-(--color-border-subtle) bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleScope(s.scope)}
                      className="mt-0.5 accent-(--color-accent-purple)"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-[family-name:var(--font-mono)] text-xs font-semibold text-(--color-text-primary)">
                          {s.scope}
                        </span>
                        {s.risk === "high" && (
                          <span className="rounded bg-(--color-accent-orange)/20 px-1.5 py-0.5 text-[10px] text-(--color-accent-orange)">
                            live
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-(--color-text-tertiary)">
                        {s.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || selectedScopes.length === 0}
              className="flex h-10 items-center gap-1.5 rounded-full bg-(--color-accent-purple) px-5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {submitting ? "Generating…" : "Generate API Key"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="h-10 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary)"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Edit Key Panel */}
      {editingKey && (
        <form onSubmit={handleSaveEdit} className="card-elevated space-y-5 rounded-2xl border border-(--color-accent-purple)/40 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-(--color-accent-purple)" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                Edit API Key — {editingKey.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setEditingKey(null)}
              aria-label="Close edit form"
              className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-key-name" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                Agent / Integration Name *
              </label>
              <input
                id="edit-key-name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="admin-input"
              />
            </div>

            <div>
              <label htmlFor="edit-key-author" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                Default Author Byline
              </label>
              <select
                id="edit-key-author"
                value={editAuthorId}
                onChange={(e) => setEditAuthorId(e.target.value)}
                className="admin-input"
              >
                <option value="">None (Agent specifies author slug)</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_en} ({a.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-key-desc" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                Description / Purpose
              </label>
              <input
                id="edit-key-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="admin-input"
              />
            </div>

            <div>
              <label htmlFor="edit-key-rate" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
                Rate Limit / min
              </label>
              <select
                id="edit-key-rate"
                value={editRateLimit}
                onChange={(e) => setEditRateLimit(Number(e.target.value))}
                className="admin-input"
              >
                <option value={30}>30 req/min</option>
                <option value={60}>60 req/min</option>
                <option value={120}>120 req/min</option>
                <option value={300}>300 req/min</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <span className="text-xs font-medium text-(--color-text-secondary)">Permission Scopes</span>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {scopeCatalog.map((s) => {
                const checked = editScopes.includes(s.scope);
                return (
                  <label
                    key={s.scope}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                      checked
                        ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/10"
                        : "border-(--color-border-subtle) bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEditScope(s.scope)}
                      className="mt-0.5 accent-(--color-accent-purple)"
                    />
                    <div className="min-w-0">
                      <span className="font-[family-name:var(--font-mono)] text-xs font-semibold text-(--color-text-primary)">
                        {s.scope}
                      </span>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-(--color-text-tertiary)">
                        {s.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || editScopes.length === 0}
              className="flex h-10 items-center gap-1.5 rounded-full bg-(--color-accent-purple) px-5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditingKey(null)}
              className="h-10 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary)"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Existing API Keys Table */}
      <div className="card-elevated overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border-subtle) text-xs text-(--color-text-tertiary)">
                <th className="px-5 py-3 text-start font-medium">Integration Name</th>
                <th className="px-5 py-3 text-start font-medium">Prefix</th>
                <th className="px-5 py-3 text-start font-medium">Scopes</th>
                <th className="px-5 py-3 text-start font-medium">Usage</th>
                <th className="px-5 py-3 text-start font-medium">Status</th>
                <th className="px-5 py-3 text-end font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-(--color-text-tertiary)">
                    Loading API keys…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-(--color-text-tertiary)">
                    <div className="flex flex-col items-center gap-2">
                      <KeyRound className="h-7 w-7 opacity-50" />
                      <p>No API keys created yet. Click &ldquo;New API Key&rdquo; to connect an AI agent.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isConfirming = confirmAction?.id === item.id;
                  return (
                    <tr key={item.id} className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-(--color-text-primary)">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-(--color-text-tertiary)">{item.description}</p>
                        )}
                        {item.defaultAuthorName && (
                          <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                            Default author: {item.defaultAuthorName}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="rounded-md bg-white/5 px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-(--color-text-secondary)">
                          {item.keyPrefix}…
                        </code>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {item.scopes.map((sc) => (
                            <span
                              key={sc}
                              className="rounded-full bg-white/[0.06] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-secondary)"
                            >
                              {sc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-(--color-text-tertiary)">
                        <p className="text-(--color-text-secondary)">
                          {item.requestCount.toLocaleString()} calls • {item.rateLimitPerMin}/min
                        </p>
                        <p>
                          {item.lastUsedAt
                            ? `Last: ${new Date(item.lastUsedAt).toLocaleString()}`
                            : "Never used"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        {item.status === "active" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-(--color-accent-red)/15 px-2.5 py-0.5 text-xs text-(--color-accent-red)">
                            <Ban className="h-3 w-3" /> Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {isConfirming ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                confirmAction.type === "rotate" ? handleRotate(item) : handleDelete(item)
                              }
                              className="rounded-full bg-(--color-accent-red) px-3 py-1 text-xs font-medium text-white"
                            >
                              {confirmAction.type === "rotate" ? "Confirm Rotate" : "Confirm Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction(null)}
                              className="rounded-full border border-(--color-border-subtle) px-3 py-1 text-xs text-(--color-text-secondary)"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => startEdit(item)}
                              aria-label={`Edit ${item.name}`}
                              title="Edit scopes & rate limit"
                              className="rounded-lg border border-(--color-border-subtle) p-1.5 text-(--color-text-tertiary) hover:text-(--color-accent-purple)"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => setConfirmAction({ id: item.id, type: "rotate" })}
                              aria-label={`Rotate ${item.name}`}
                              title="Rotate secret token"
                              className="rounded-lg border border-(--color-border-subtle) p-1.5 text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleToggleStatus(item)}
                              aria-label={item.status === "active" ? `Revoke ${item.name}` : `Activate ${item.name}`}
                              title={item.status === "active" ? "Revoke key" : "Reactivate key"}
                              className="rounded-lg border border-(--color-border-subtle) p-1.5 text-(--color-text-tertiary) hover:text-amber-300"
                            >
                              {item.status === "active" ? (
                                <Ban className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => setConfirmAction({ id: item.id, type: "delete" })}
                              aria-label={`Delete ${item.name}`}
                              title="Delete permanently"
                              className="rounded-lg border border-(--color-border-subtle) p-1.5 text-(--color-text-tertiary) hover:text-(--color-accent-red)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live API Sandbox + Quickstart Snippets */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live Playground */}
        <div className="card-elevated min-w-0 space-y-4 rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-(--color-accent-orange)" />
            <h2 className="text-sm font-semibold text-(--color-text-primary)">Live API Sandbox</h2>
          </div>
          <p className="text-xs text-(--color-text-tertiary)">
            Test your key directly against live <code className="font-[family-name:var(--font-mono)]">/api/v1/*</code> endpoints without leaving the dashboard.
          </p>

          <div>
            <label htmlFor="sandbox-token" className="mb-1.5 block text-xs text-(--color-text-tertiary)">
              Bearer API Token (auto-filled when you generate a key)
            </label>
            <input
              id="sandbox-token"
              type="password"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              placeholder="sci_live_..."
              className="admin-input font-[family-name:var(--font-mono)] text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={testingEndpoint !== null}
              onClick={() => runPlaygroundTest("me")}
              className="rounded-full border border-(--color-border-subtle) px-3.5 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:border-(--color-accent-purple)/60 hover:text-(--color-text-primary) disabled:opacity-50"
            >
              {testingEndpoint === "me" ? "Testing…" : "1. Check Identity (/me)"}
            </button>
            <button
              type="button"
              disabled={testingEndpoint !== null}
              onClick={() => runPlaygroundTest("taxonomy")}
              className="rounded-full border border-(--color-border-subtle) px-3.5 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:border-(--color-accent-purple)/60 hover:text-(--color-text-primary) disabled:opacity-50"
            >
              {testingEndpoint === "taxonomy" ? "Loading…" : "2. Fetch Taxonomy"}
            </button>
            <button
              type="button"
              disabled={testingEndpoint !== null}
              onClick={() => runPlaygroundTest("dryrun")}
              className="rounded-full bg-(--color-accent-purple)/20 px-3.5 py-1.5 text-xs font-medium text-(--color-accent-purple) hover:bg-(--color-accent-purple)/30 disabled:opacity-50"
            >
              {testingEndpoint === "dryrun" ? "Validating…" : "3. Dry-Run MDX"}
            </button>
            <button
              type="button"
              disabled={testingEndpoint !== null}
              onClick={() => runPlaygroundTest("mcp")}
              className="rounded-full bg-(--color-accent-orange)/15 px-3.5 py-1.5 text-xs font-medium text-(--color-accent-orange) hover:bg-(--color-accent-orange)/25 disabled:opacity-50"
            >
              {testingEndpoint === "mcp" ? "Listing…" : "4. MCP tools/list"}
            </button>
          </div>

          {testResult && (
            <div className="space-y-2 rounded-xl border border-(--color-border-subtle) bg-black/40 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
                  {testResult.endpoint}
                </span>
                <div className="flex items-center gap-2">
                  {testResult.rateLimit && (
                    <span className="text-[11px] text-(--color-text-tertiary)">{testResult.rateLimit}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] ${
                      testResult.status >= 200 && testResult.status < 300
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-(--color-accent-red)/20 text-(--color-accent-red)"
                    }`}
                  >
                    HTTP {testResult.status}
                  </span>
                </div>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-(--color-text-secondary)">
                {testResult.body}
              </pre>
            </div>
          )}
        </div>

        {/* Code Snippets & GPT Action Guide */}
        <div className="card-elevated min-w-0 space-y-4 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-(--color-accent-purple)" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">AI Agent Quickstart</h2>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(snippets[activeTab], `snippet-${activeTab}`)}
              className="inline-flex items-center gap-1 rounded-full border border-(--color-border-subtle) px-3 py-1 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
            >
              {copiedId === `snippet-${activeTab}` ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy Snippet
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "mcp", label: "Claude / Cursor MCP" },
                { id: "gpt", label: "ChatGPT Actions" },
                { id: "curl", label: "cURL" },
                { id: "python", label: "Python" },
                { id: "node", label: "Node / TS" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "bg-(--color-accent-purple) text-white"
                    : "border border-(--color-border-subtle) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <pre className="max-h-80 overflow-x-auto overflow-y-auto rounded-xl border border-(--color-border-subtle) bg-black/50 p-4 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-(--color-text-secondary)">
            {snippets[activeTab]}
          </pre>
        </div>
      </div>
    </div>
  );
}
