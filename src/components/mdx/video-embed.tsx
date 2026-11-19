import { validateEmbedUrl } from "@/lib/security";

export function VideoEmbed({ src, title, caption }: { src: string; title: string; caption?: string }) {
  const safeSrc = validateEmbedUrl(src);
  if (!safeSrc) {
    return (
      <figure className="not-prose my-10">
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-(--color-border-subtle) bg-black/40 p-6 text-sm text-(--color-text-tertiary)">
          Unsupported video embed source.
        </div>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className="not-prose my-10">
      <div className="aspect-video overflow-hidden rounded-2xl border border-(--color-border-subtle) bg-black">
        <iframe
          src={safeSrc}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
