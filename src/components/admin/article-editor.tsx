"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save, Eye, EyeOff, Loader2, Trash2, History, Star, TrendingUp,
  ChevronDown, X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { MdxPreview } from "./mdx-preview";

interface TranslationState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  twitterCard: string;
}

const emptyTranslation: TranslationState = {
  title: "", slug: "", excerpt: "", content: "", seoTitle: "", seoDescription: "",
  seoKeywords: "", canonicalUrl: "", twitterCard: "summary_large_image",
};

interface LookupItem { id: string; slug: string; name_fa: string; name_en: string }
interface AuthorLookupItem { id: string; slug: string; name_fa: string; name_en: string }
interface TagLookupItem { id: string; slug: string; name_fa: string; name_en: string }

interface Revision {
  id: string; locale: "fa" | "en"; title: string; content: string;
  note: string | null; created_at: string; editor_name: string | null;
}

function slugify(input: string, locale: "fa" | "en") {
  if (locale === "en") {
    return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  }
  return input.trim().replace(/[.,،؛:;!؟?"'`«»<>]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function ArticleEditor({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(articleId);

  const [fa, setFa] = useState<TranslationState>(emptyTranslation);
  const [en, setEn] = useState<TranslationState>(emptyTranslation);
  const [activeLocale, setActiveLocale] = useState<"fa" | "en">("en");
  const [showPreview, setShowPreview] = useState(true);
  const [slugTouched, setSlugTouched] = useState({ fa: false, en: false });

  const [fieldId, setFieldId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [authorId, setAuthorId] = useState<string>("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">("draft");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [featured, setFeatured] = useState(false);
  const [trending, setTrending] = useState(false);

  const [fields, setFields] = useState<LookupItem[]>([]);
  const [categories, setCategories] = useState<LookupItem[]>([]);
  const [authors, setAuthors] = useState<AuthorLookupItem[]>([]);
  const [tags, setTags] = useState<TagLookupItem[]>([]);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  useEffect(() => {
    Promise.all([
      adminFetch<{ items: LookupItem[] }>("/api/admin/fields"),
      adminFetch<{ items: LookupItem[] }>("/api/admin/categories"),
      adminFetch<{ items: AuthorLookupItem[] }>("/api/admin/authors"),
      adminFetch<{ items: TagLookupItem[] }>("/api/admin/tags"),
    ]).then(([f, c, a, t]) => {
      setFields(f.items);
      setCategories(c.items);
      setAuthors(a.items);
      setTags(t.items);
    }).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!articleId) return;
    adminFetch<{
      field_id: string | null; category_id: string | null; author_id: string | null;
      status: "draft" | "published" | "scheduled"; featured: number; trending: number;
      scheduled_at: string | null; tagIds: string[];
      translations: Record<string, TranslationState>;
    }>(`/api/admin/articles/${articleId}`)
      .then((data) => {
        setFieldId(data.field_id ?? "");
        setCategoryId(data.category_id ?? "");
        setAuthorId(data.author_id ?? "");
        setStatus(data.status);
        setFeatured(!!data.featured);
        setTrending(!!data.trending);
        setScheduledAt(data.scheduled_at ?? "");
        setTagIds(data.tagIds ?? []);
        if (data.translations.fa) setFa({ ...emptyTranslation, ...data.translations.fa });
        if (data.translations.en) setEn({ ...emptyTranslation, ...data.translations.en });
        setSlugTouched({ fa: true, en: true });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [articleId]);

  useEffect(() => {
    if (showRevisions && articleId) {
      adminFetch<{ items: Revision[] }>(`/api/admin/articles/${articleId}/revisions?locale=${activeLocale}`)
        .then((data) => setRevisions(data.items))
        .catch(() => {});
    }
  }, [showRevisions, articleId, activeLocale]);

  const state = activeLocale === "fa" ? fa : en;
  const setState = activeLocale === "fa" ? setFa : setEn;

  const updateField = useCallback(
    (key: keyof TranslationState, value: string) => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "title" && !slugTouched[activeLocale]) {
          next.slug = slugify(value, activeLocale);
        }
        return next;
      });
    },
    [setState, slugTouched, activeLocale]
  );

  const toggleTag = (id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  async function handleSave(publishNow?: boolean) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        fieldId: fieldId || null,
        categoryId: categoryId || null,
        authorId: authorId || null,
        status: publishNow ? "published" : status,
        featured,
        trending,
        scheduledAt: status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        tagIds,
        translations: { fa, en },
      };

      if (isEdit) {
        await adminFetch(`/api/admin/articles/${articleId}`, { method: "PUT", body: JSON.stringify(payload) });
        setSuccess("Saved successfully");
      } else {
        const res = await adminFetch<{ id: string }>("/api/admin/articles", { method: "POST", body: JSON.stringify(payload) });
        router.push(`/admin/articles/${res.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTrash() {
    if (!articleId || !confirm("Move this article to the recycle bin?")) return;
    await adminFetch(`/api/admin/articles/${articleId}`, { method: "DELETE" });
    router.push("/admin/articles");
  }

  const tagLabel = (t: TagLookupItem) => (activeLocale === "fa" ? t.name_fa : t.name_en);
  const lookupLabel = (item: LookupItem) => (activeLocale === "fa" ? item.name_fa : item.name_en);

  if (loading) return <div className="card-elevated h-96 animate-pulse rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            {isEdit ? "Edit Article" : "New Article"}
          </h1>
          {success && <p className="text-xs text-(--color-accent-orange)">{success}</p>}
          {error && <p className="text-xs text-(--color-accent-red)">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button onClick={() => setShowRevisions(true)} className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)">
              <History className="h-3.5 w-3.5" /> Revisions
            </button>
          )}
          {isEdit && (
            <button onClick={handleTrash} className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-accent-red) hover:border-(--color-accent-red)/50">
              <Trash2 className="h-3.5 w-3.5" /> Trash
            </button>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary) disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save {status === "draft" ? "Draft" : ""}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-xs font-medium text-white disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main editor column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(["en", "fa"] as const).map((locale) => (
              <button
                key={locale}
                onClick={() => setActiveLocale(locale)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  activeLocale === locale
                    ? "bg-(--color-accent-purple) text-white"
                    : "border border-(--color-border-subtle) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {locale === "en" ? "English" : "فارسی"}
              </button>
            ))}
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="ms-auto flex h-8 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-3 text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>

          <div className="card-elevated space-y-4 rounded-2xl p-5">
            <input
              value={state.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Article title"
              dir={activeLocale === "fa" ? "rtl" : "ltr"}
              className="w-full border-0 border-b border-(--color-border-subtle) bg-transparent pb-3 font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
            />
            <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
              <span>/{activeLocale}/articles/</span>
              <input
                value={state.slug}
                onChange={(e) => {
                  setSlugTouched((p) => ({ ...p, [activeLocale]: true }));
                  updateField("slug", e.target.value);
                }}
                className="flex-1 rounded-lg border border-(--color-border-subtle) bg-black/20 px-2 py-1 text-(--color-text-secondary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
            <textarea
              value={state.excerpt}
              onChange={(e) => updateField("excerpt", e.target.value)}
              placeholder="Short excerpt (shown on cards and in search results)"
              dir={activeLocale === "fa" ? "rtl" : "ltr"}
              rows={2}
              className="w-full resize-none rounded-lg border border-(--color-border-subtle) bg-black/20 px-3 py-2 text-sm text-(--color-text-secondary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>

          <div className={`grid gap-4 ${showPreview ? "lg:grid-cols-2" : ""}`}>
            <textarea
              value={state.content}
              onChange={(e) => updateField("content", e.target.value)}
              placeholder={"Write MDX here…\n\n## Heading\n\n$$E = mc^2$$\n\n```mermaid\ngraph TD; A-->B;\n```"}
              dir={activeLocale === "fa" ? "rtl" : "ltr"}
              className="card-elevated min-h-[480px] rounded-2xl p-5 font-[family-name:var(--font-mono)] text-sm text-(--color-text-primary) outline-none focus:border-(--color-border-strong)"
              style={{ resize: "vertical" }}
            />
            {showPreview && (
              <div className="card-elevated min-h-[480px] overflow-y-auto rounded-2xl p-5">
                <MdxPreview content={state.content} />
              </div>
            )}
          </div>

          {/* SEO */}
          <details className="card-elevated group rounded-2xl p-5" open>
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-(--color-text-primary)">
              SEO &amp; Social
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <LabeledInput label="SEO Title" value={state.seoTitle} onChange={(v) => updateField("seoTitle", v)} />
              <LabeledInput label="Canonical URL" value={state.canonicalUrl} onChange={(v) => updateField("canonicalUrl", v)} />
              <LabeledTextarea label="SEO Description" value={state.seoDescription} onChange={(v) => updateField("seoDescription", v)} className="sm:col-span-2" />
              <LabeledInput label="SEO Keywords (comma-separated)" value={state.seoKeywords} onChange={(v) => updateField("seoKeywords", v)} className="sm:col-span-2" />
              <div>
                <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Twitter Card Type</label>
                <select
                  value={state.twitterCard}
                  onChange={(e) => updateField("twitterCard", e.target.value)}
                  className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-black/20 px-3 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                >
                  <option value="summary_large_image">summary_large_image</option>
                  <option value="summary">summary</option>
                </select>
              </div>
            </div>
          </details>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card-elevated space-y-4 rounded-2xl p-5">
            <div>
              <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-black/20 px-3 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            {status === "scheduled" && (
              <div>
                <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Publish at</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-black/20 px-3 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-(--color-text-secondary)"><Star className="h-3.5 w-3.5" /> Featured</span>
              <Toggle checked={featured} onChange={setFeatured} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-(--color-text-secondary)"><TrendingUp className="h-3.5 w-3.5" /> Trending</span>
              <Toggle checked={trending} onChange={setTrending} />
            </div>
          </div>

          <div className="card-elevated space-y-4 rounded-2xl p-5">
            <SelectField label="Scientific Field" value={fieldId} onChange={setFieldId} options={fields.map((f) => ({ value: f.id, label: lookupLabel(f) }))} />
            <SelectField label="Category" value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: lookupLabel(c) }))} />
            <SelectField label="Author" value={authorId} onChange={setAuthorId} options={authors.map((a) => ({ value: a.id, label: activeLocale === "fa" ? a.name_fa : a.name_en }))} />
          </div>

          <div className="card-elevated rounded-2xl p-5">
            <p className="mb-3 text-xs text-(--color-text-tertiary)">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    tagIds.includes(t.id)
                      ? "bg-(--color-accent-purple) text-white"
                      : "border border-(--color-border-subtle) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {tagLabel(t)}
                </button>
              ))}
              {tags.length === 0 && <p className="text-xs text-(--color-text-tertiary)">No tags yet — create some in Tags.</p>}
            </div>
          </div>
        </div>
      </div>

      {showRevisions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/70 p-4" onClick={() => setShowRevisions(false)}>
          <div className="glass-panel max-h-[80vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-(--color-text-primary)">Revision History ({activeLocale})</h2>
              <button onClick={() => setShowRevisions(false)}><X className="h-5 w-5 text-(--color-text-tertiary)" /></button>
            </div>
            {revisions.length === 0 && <p className="text-sm text-(--color-text-tertiary)">No revisions saved yet — they&apos;re created automatically each time you save.</p>}
            <div className="space-y-3">
              {revisions.map((rev) => (
                <details key={rev.id} className="rounded-xl border border-(--color-border-subtle) p-3">
                  <summary className="cursor-pointer text-sm text-(--color-text-secondary)">
                    {rev.title} — <span className="text-(--color-text-tertiary)">{new Date(rev.created_at).toLocaleString()}</span>
                    {rev.editor_name && <span className="text-(--color-text-tertiary)"> by {rev.editor_name}</span>}
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-(--color-text-tertiary)">{rev.content}</pre>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-black/20 px-3 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
      />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-(--color-border-subtle) bg-black/20 px-3 py-2 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-black/20 px-3 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
      >
        <option value="">— None —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 rounded-full p-0.5 transition-colors ${checked ? "bg-(--color-accent-purple)" : "bg-white/10"}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5 rtl:-translate-x-5" : ""}`} />
    </button>
  );
}
