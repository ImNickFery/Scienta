import { compileMDX } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { validateMdxSafety } from "./security";
import { remarkStrictStaticMdx } from "./mdx-safety-ast";
import { lintMdxEditorialQuality } from "./ai-api-articles";

export { lintMdxEditorialQuality };

export interface MdxCompileValidationResult {
  ok: boolean;
  error?: {
    message: string;
    line?: number;
    column?: number;
    hint: string;
  };
  qualityWarnings: string[];
}

function preprocessMermaidSafe(source: string): string {
  return source.replace(/```mermaid\r?\n([\s\S]*?)```/g, (_match, code: string) => {
    return `<Mermaid chart={${JSON.stringify(code.trim())}} />`;
  });
}

/**
 * Runs both the security validator AND the actual `compileMDX` compiler
 * (remarkStrictStaticMdx, remark-math, remark-gfm, rehype-slug, rehype-katex)
 * so malformed JSX, unclosed component tags, or executable JS expressions are
 * rejected with HTTP 422 BEFORE saving to the database.
 */
export async function validateMdxCompiles(params: {
  content: string;
  locale: "fa" | "en";
  excerpt?: string;
  hasCover?: boolean;
}): Promise<MdxCompileValidationResult> {
  const safety = validateMdxSafety(params.content);
  if (!safety.safe) {
    return {
      ok: false,
      error: {
        message: safety.reason ?? "Forbidden MDX construct detected.",
        hint: "Remove raw <script>, <iframe>, inline DOM handlers, or JS imports. Use Scienta MDX components instead.",
      },
      qualityWarnings: [],
    };
  }

  const qualityWarnings = lintMdxEditorialQuality(params);

  try {
    const source = preprocessMermaidSafe(params.content);
    await compileMDX({
      source,
      components: mdxComponents,
      options: {
        blockJS: false,
        mdxOptions: {
          remarkPlugins: [remarkStrictStaticMdx, remarkMath, remarkGfm],
          rehypePlugins: [
            rehypeSlug,
            [rehypeKatex, { trust: false, strict: false, maxExpand: 300, maxSize: 15 }],
          ],
        },
      },
    });
    return { ok: true, qualityWarnings };
  } catch (err) {
    const e = err as {
      message?: string;
      line?: number;
      column?: number;
      position?: { start?: { line?: number; column?: number } };
    };
    const rawMsg = e?.message || (err instanceof Error ? err.message : "MDX syntax compilation failed.");
    const cleanedLines = rawMsg
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("[next-mdx-remote]") && !l.startsWith("More information:"));
    const diagnostic = cleanedLines.slice(0, 2).join(" — ") || rawMsg.split("\n")[0];

    let line = e?.line ?? e?.position?.start?.line;
    let column = e?.column ?? e?.position?.start?.column;
    if (line === undefined) {
      const coordMatch = /\((\d+):(\d+)(?:-\d+:\d+)?\)/.exec(rawMsg) || /(\d+):(\d+)/.exec(diagnostic);
      if (coordMatch) {
        line = Number(coordMatch[1]);
        column = Number(coordMatch[2]);
      }
    }

    return {
      ok: false,
      error: {
        message: `MDX compile error in '${params.locale}': ${diagnostic}`,
        ...(typeof line === "number" && Number.isFinite(line) ? { line } : {}),
        ...(typeof column === "number" && Number.isFinite(column) ? { column } : {}),
        hint: "Check for unclosed JSX tags, stray '<' or '{' characters outside code/math blocks (wrap formulas in $...$ or escape '<' as '&lt;'), or invalid JSX prop syntax.",
      },
      qualityWarnings,
    };
  }
}
