"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Upload, Check, Loader2, ImageOff, ImagePlus } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { buildFigureMdx } from "@/lib/mdx-snippets";

interface MediaPickerItem {
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
}

interface MediaPickerModalProps {
  onClose: () => void;
  onInsert: (figureMdx: string) => void;
}

export function MediaPickerModal({ onClose, onInsert }: MediaPickerModalProps) {
  const [items, setItems] = useState<MediaPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [aspect, setAspect] = useState<"video" | "square" | "portrait" | "wide">("video");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    adminFetch<{ items: MediaPickerItem[] }>("/api/admin/media?pageSize=48")
      .then((data) => {
        if (!active) return;
        setItems(data.items);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load media library");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.original_name.toLowerCase().includes(q) ||
        i.filename.toLowerCase().includes(q) ||
        (i.alt_text && i.alt_text.toLowerCase().includes(q))
    );
  }, [items, search]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  function selectItem(item: MediaPickerItem) {
    setSelectedId(item.id);
    setAltText(item.alt_text || item.original_name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      const uploaded = await adminFetch<{ id: string; path: string; originalName: string }>(
        "/api/admin/media",
        { method: "POST", body: formData }
      );
      const fresh = await adminFetch<{ items: MediaPickerItem[] }>("/api/admin/media?pageSize=48");
      setItems(fresh.items);
      setSelectedId(uploaded.id);
      setAltText(uploaded.originalName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleConfirmInsert() {
    if (!selectedItem) return;
    const mdx = buildFigureMdx({
      src: selectedItem.path,
      alt: altText.trim() || selectedItem.original_name,
      caption: caption.trim() || undefined,
      aspect,
    });
    onInsert(mdx);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Insert image from Media Library"
      onClick={onClose}
    >
      <div
        className="card-elevated flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-(--color-border-strong)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-6 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)">
              Insert Image from Media Library
            </h2>
            <p className="text-xs text-(--color-text-tertiary)">
              Pick an existing asset or upload a new image to insert a responsive &lt;Figure /&gt; block
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Media Library picker"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-(--color-border-subtle) px-6 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter images by name…"
              aria-label="Filter media images"
              className="h-9 w-full rounded-full border border-(--color-border-subtle) bg-black/25 ps-9 pe-4 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-subtle) bg-white/[0.04] px-4 text-xs font-medium text-(--color-text-primary) hover:border-(--color-accent-purple) disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : "Upload New Image"}
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-3 rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-3 py-2 text-xs text-(--color-accent-red)">
            {error}
          </div>
        )}

        <div className="grid flex-1 gap-4 overflow-hidden p-6 lg:grid-cols-[1fr_280px]">
          <div className="overflow-y-auto pe-1">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-video animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-(--color-border-subtle) text-center text-(--color-text-tertiary)">
                <ImageOff className="mb-2 h-7 w-7 opacity-60" />
                <p className="text-sm text-(--color-text-secondary)">
                  {items.length === 0 ? "No images uploaded yet" : "No matching images"}
                </p>
                <p className="mt-1 text-xs">
                  Upload a PNG, JPG, WebP, or AVIF image using the button above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filtered.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      aria-label={`Select ${item.original_name}`}
                      className={`group relative overflow-hidden rounded-xl border text-start transition-all ${
                        isSelected
                          ? "border-(--color-accent-purple) ring-2 ring-(--color-accent-purple)/40"
                          : "border-(--color-border-subtle) hover:border-(--color-border-strong)"
                      }`}
                    >
                      <div className="relative aspect-video w-full bg-black/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumbnail_path ?? item.path}
                          alt={item.alt_text || item.original_name}
                          className="h-full w-full object-cover"
                        />
                        {isSelected && (
                          <span className="absolute top-2 end-2 flex h-6 w-6 items-center justify-center rounded-full bg-(--color-accent-purple) text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="truncate bg-black/40 px-2.5 py-1.5 text-[11px] text-(--color-text-secondary)">
                        {item.original_name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-(--color-border-subtle) bg-black/20 p-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-(--color-text-primary)">Figure Properties</p>
              {selectedItem ? (
                <>
                  <div className="overflow-hidden rounded-lg border border-(--color-border-subtle) bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedItem.thumbnail_path ?? selectedItem.path}
                      alt={altText || selectedItem.original_name}
                      className="aspect-video w-full object-cover"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-(--color-text-tertiary)">Alt Text</label>
                    <input
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Describe the scientific figure"
                      className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-black/30 px-2.5 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-(--color-text-tertiary)">Caption (optional)</label>
                    <input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Fig 1. Observed spectrum…"
                      className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-black/30 px-2.5 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-(--color-text-tertiary)">Aspect Ratio</label>
                    <select
                      value={aspect}
                      onChange={(e) => setAspect(e.target.value as typeof aspect)}
                      className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-black/30 px-2.5 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                    >
                      <option value="video">16:9 (Default)</option>
                      <option value="wide">21:9 (Cinematic Wide)</option>
                      <option value="square">1:1 (Square)</option>
                      <option value="portrait">3:4 (Portrait)</option>
                    </select>
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-xs text-(--color-text-tertiary)">
                  Select an image from the grid to configure alt text, caption, and aspect ratio.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirmInsert}
              disabled={!selectedItem}
              className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) text-xs font-medium text-white disabled:opacity-40"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Insert Figure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
