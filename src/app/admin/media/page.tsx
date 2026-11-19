"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Trash2, Copy, Check, Loader2, ImageOff } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface MediaItem {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  path: string;
  thumbnail_path: string | null;
  created_at: string;
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ items: MediaItem[] }>("/api/admin/media?pageSize=60");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        await adminFetch("/api/admin/media", { method: "POST", body: formData });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await adminFetch(`/api/admin/media/${id}`, { method: "DELETE" });
    setConfirmingId(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function copyUrl(item: MediaItem) {
    navigator.clipboard.writeText(window.location.origin + item.path);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Media Library</h1>
          <p className="text-sm text-(--color-text-tertiary)">Upload and manage images used across your articles</p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? "border-(--color-accent-purple) bg-(--color-accent-purple)/5" : "border-(--color-border-subtle) hover:border-(--color-border-strong)"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        {uploading ? <Loader2 className="h-8 w-8 animate-spin text-(--color-accent-purple)" /> : <Upload className="h-8 w-8 text-(--color-text-tertiary)" />}
        <p className="text-sm text-(--color-text-secondary)">
          {uploading ? "Uploading…" : "Drag and drop images here, or click to browse"}
        </p>
        <p className="text-xs text-(--color-text-tertiary)">JPEG, PNG, WebP, GIF — up to 8MB each</p>
      </div>

      {error && <p className="rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-2 text-sm text-(--color-accent-red)">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="card-elevated aspect-square animate-pulse rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-(--color-text-tertiary)">
          <ImageOff className="h-8 w-8" />
          <p className="text-sm">No media uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <div key={item.id} className="card-elevated group relative aspect-square overflow-hidden rounded-2xl">
              {item.thumbnail_path || item.mime_type === "image/svg+xml" ? (
                <Image
                  src={item.thumbnail_path ?? item.path}
                  alt={item.original_name}
                  fill
                  sizes="200px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-(--color-text-tertiary)">
                  <ImageOff className="h-6 w-6" />
                </div>
              )}
              <div className={`absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 transition-opacity ${confirmingId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <p className="truncate text-[10px] text-white/80">{item.original_name}</p>
                {confirmingId === item.id ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="flex h-7 flex-1 items-center justify-center rounded-lg bg-(--color-accent-red) text-[10px] font-medium text-white"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="flex h-7 flex-1 items-center justify-center rounded-lg bg-white/15 text-[10px] text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => copyUrl(item)} className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 text-[10px] text-white hover:bg-white/20">
                      {copiedId === item.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button type="button" onClick={() => setConfirmingId(item.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-(--color-accent-red)/60">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
