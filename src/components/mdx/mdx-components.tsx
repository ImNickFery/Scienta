import * as React from "react";
import Link from "next/link";
import { sanitizeUrl } from "@/lib/security";
import { Mermaid } from "./mermaid";
import { CodeBlock } from "./code-block";
import { Callout } from "./callout";
import { Figure } from "./figure";
import { ImageGallery } from "./image-gallery";
import { SideBySide } from "./side-by-side";
import { PullQuote } from "./pull-quote";
import { Timeline } from "./timeline";
import { VideoEmbed } from "./video-embed";
import { ComparisonCards } from "./comparison-cards";
import { StatHighlight } from "./stat-highlight";
import { Theorem, Lemma, Corollary, Proof } from "./theorem";

function Heading({ level, children, ...props }: { level: 2 | 3 | 4 } & React.HTMLAttributes<HTMLHeadingElement>) {
  const Tag = `h${level}` as "h2" | "h3" | "h4";
  const sizes = { 2: "text-2xl sm:text-3xl mt-14 mb-5", 3: "text-xl sm:text-2xl mt-10 mb-4", 4: "text-lg mt-8 mb-3" };
  return (
    <Tag className={`group scroll-mt-24 font-bold ${sizes[level]}`} {...props}>
      <a href={`#${props.id}`} className="no-underline">
        {children}
        <span className="ms-2 text-(--color-accent-purple) opacity-0 transition-opacity group-hover:opacity-100">
          #
        </span>
      </a>
    </Tag>
  );
}

export const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <Heading level={2} {...props} />,
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <Heading level={3} {...props} />,
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => <Heading level={4} {...props} />,
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p className="mb-6 leading-[1.9]" {...props} />,
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-6 ms-5 list-disc space-y-2 marker:text-(--color-accent-purple)" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-6 ms-5 list-decimal space-y-2 marker:text-(--color-accent-orange)" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="ps-1" {...props} />,
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-8 rounded-e-xl border-s-[3px] border-(--color-accent-purple) bg-white/[0.03] py-4 ps-6 pe-4 text-(--color-text-primary)"
      {...props}
    />
  ),
  a: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const safeHref = sanitizeUrl(href, { allowRelative: true, allowMailto: true, allowHash: true });
    if (!safeHref) {
      return <span className="text-(--color-text-secondary)">{children}</span>;
    }
    const isExternal = safeHref.startsWith("http://") || safeHref.startsWith("https://") || safeHref.startsWith("mailto:");
    if (isExternal) {
      return (
        <a
          {...rest}
          href={safeHref}
          className="text-(--color-accent-orange) underline decoration-(--color-accent-orange)/40 underline-offset-4 hover:decoration-(--color-accent-orange)"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={safeHref}
        className="text-(--color-accent-orange) underline decoration-(--color-accent-orange)/40 underline-offset-4 hover:decoration-(--color-accent-orange)"
      >
        {children}
      </Link>
    );
  },
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-8 w-full max-w-full overflow-x-auto rounded-xl border border-(--color-border-subtle)">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-white/[0.04] text-start text-(--color-text-primary)" {...props} />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="transition-colors hover:bg-white/[0.025]" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="prose-table-cell border-b border-(--color-border-subtle) px-4 py-3 text-start font-semibold leading-relaxed" {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="prose-table-cell border-b border-(--color-border-subtle)/60 px-4 py-3 leading-relaxed text-(--color-text-secondary)" {...props} />
  ),
  hr: () => <hr className="my-12 border-(--color-border-subtle)" />,
  pre: CodeBlock,
  img: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const safeSrc = typeof src === "string" ? sanitizeUrl(src, { allowRelative: true, allowHash: false }) : null;
    if (!safeSrc) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...rest}
        src={safeSrc}
        referrerPolicy="no-referrer"
        className="my-8 w-full rounded-2xl border border-(--color-border-subtle)"
        loading="lazy"
        alt={alt ?? ""}
      />
    );
  },
  Mermaid,
  Callout,
  Figure,
  ImageGallery,
  SideBySide,
  PullQuote,
  Timeline,
  VideoEmbed,
  ComparisonCards,
  StatHighlight,
  Theorem,
  Lemma,
  Corollary,
  Proof,
};
