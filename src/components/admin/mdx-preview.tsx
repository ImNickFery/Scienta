"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function MdxPreview({ content, dir = "ltr" }: { content: string; dir?: "rtl" | "ltr" }) {
  return (
    <div dir={dir} className="prose-scientific mx-auto max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { trust: false, strict: false, maxExpand: 300, maxSize: 15 }]]}
      >
        {content || "*Nothing to preview yet — start writing on the left.*"}
      </ReactMarkdown>
    </div>
  );
}
