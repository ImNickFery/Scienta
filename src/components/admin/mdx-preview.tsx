"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function MdxPreview({ content }: { content: string }) {
  return (
    <div className="prose-scientific mx-auto max-w-none">
      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
        {content || "*Nothing to preview yet — start writing on the left.*"}
      </ReactMarkdown>
    </div>
  );
}
