import { compileMDX } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { DEFAULT_NUMERALS, type Numerals } from "@/lib/i18n/numerals";
import { validateMdxSafety } from "@/lib/security";
import { remarkStrictStaticMdx } from "@/lib/mdx-safety-ast";

function preprocessMermaid(source: string): string {
  return source.replace(/```mermaid\r?\n([\s\S]*?)```/g, (_match, code: string) => {
    // Serialize as a JSON string literal (never a template literal) so `${...}`
    // expressions or backslashes inside Mermaid blocks cannot execute JS at SSR time.
    return `<Mermaid chart={${JSON.stringify(code.trim())}} />`;
  });
}

/**
 * Rewrites Persian and Arabic-Indic digits to ASCII across the MDX source.
 *
 * The `ss01` font feature can retype ASCII digits as Persian ones but not the
 * reverse — a real ۲۰۱۹ in the source is already a Persian codepoint and no
 * font feature will undo it. Persian articles are written that way, so the
 * reader's "Latin numerals" choice only reaches article bodies through this.
 *
 * This runs on the source rather than on the rendered tree because much of the
 * content lives in JSX props — `<StatHighlight stats={[{ value: "۶.۵ میلیارد" }]} />`
 * and friends — which a rehype plugin never sees; those become compiled
 * JavaScript, not HAST text nodes.
 *
 * Fenced blocks, inline code, and math are held out: a digit inside a snippet
 * or an equation is part of the thing being quoted, not prose to restyle. The
 * split keeps the delimiters, so only the odd-indexed prose segments change.
 */
function toLatinDigits(source: string): string {
  const protectedSpans = /(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g;
  return source
    .split(protectedSpans)
    .map((segment, i) =>
      i % 2 === 1
        ? segment
        : segment.replace(/[۰-۹٠-٩]/g, (d) => {
            const code = d.charCodeAt(0);
            return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
          })
    )
    .join("");
}

export async function renderMdx(content: string, numerals: Numerals = DEFAULT_NUMERALS) {
  const safety = validateMdxSafety(content);
  if (!safety.safe) {
    throw new Error(`Unsafe MDX content rejected: ${safety.reason}`);
  }

  // Digits first, while fenced blocks are still fences — preprocessMermaid
  // rewrites those into JSX and the protection would no longer apply.
  const source = preprocessMermaid(numerals === "latn" ? toLatinDigits(content) : content);
  const needsCodeHighlighter = source.includes("```") || source.includes("{:");
  const rehypePlugins: NonNullable<
    NonNullable<Parameters<typeof compileMDX>[0]["options"]>["mdxOptions"]
  >["rehypePlugins"] = [
    rehypeSlug,
    [rehypeKatex, { trust: false, strict: false, maxExpand: 300, maxSize: 15 }],
  ];

  if (needsCodeHighlighter) {
    rehypePlugins.push([
      rehypePrettyCode,
      {
        theme: "one-dark-pro",
        keepBackground: false,
      },
    ]);
  }

  const { content: rendered } = await compileMDX({
    source,
    components: mdxComponents,
    options: {
      // JSX attribute expressions are restricted to pure static JSON-like literals
      // at the ESTree AST level by `remarkStrictStaticMdx` before code generation.
      blockJS: false,
      mdxOptions: {
        remarkPlugins: [remarkStrictStaticMdx, remarkMath, remarkGfm],
        rehypePlugins,
      },
    },
  });
  return rendered;
}
