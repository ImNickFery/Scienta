import { compileMDX } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { DEFAULT_NUMERALS, type Numerals } from "@/lib/i18n/numerals";

function preprocessMermaid(source: string): string {
  return source.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code: string) => {
    const escaped = code.replace(/`/g, "\\`").trim();
    return `<Mermaid chart={\`${escaped}\`} />`;
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
  // Digits first, while fenced blocks are still fences — preprocessMermaid
  // rewrites those into JSX and the protection would no longer apply.
  const source = preprocessMermaid(numerals === "latn" ? toLatinDigits(content) : content);
  const { content: rendered } = await compileMDX({
    source,
    components: mdxComponents,
    options: {
      // Content is authored exclusively by authenticated admins/editors
      // (see the RBAC-gated article editor), never by end users, so it's
      // safe to allow JS expression props like `stats={[{...}]}` that
      // next-mdx-remote strips by default as an anti-XSS measure for
      // untrusted MDX. HTML output is still escaped normally by React;
      // this only affects whether JSX attribute *expressions* survive.
      blockJS: false,
      mdxOptions: {
        remarkPlugins: [remarkMath, remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          rehypeKatex,
          [
            rehypePrettyCode,
            {
              theme: "one-dark-pro",
              keepBackground: false,
            },
          ],
        ],
      },
    },
  });
  return rendered;
}
