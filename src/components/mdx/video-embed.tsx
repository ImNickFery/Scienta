export function VideoEmbed({ src, title, caption }: { src: string; title: string; caption?: string }) {
  return (
    <figure className="not-prose my-10">
      <div className="aspect-video overflow-hidden rounded-2xl border border-(--color-border-subtle) bg-black">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
