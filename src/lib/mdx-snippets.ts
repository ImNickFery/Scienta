export type MdxSnippetId =
  | "h2"
  | "bold"
  | "italic"
  | "inline-math"
  | "block-math"
  | "mermaid"
  | "callout"
  | "theorem"
  | "table"
  | "code"
  | "stats";

export interface MdxSnippetDefinition {
  id: MdxSnippetId;
  label: string;
  shortLabel: string;
  group: "format" | "math" | "scientific";
  mode: "wrap" | "block";
}

export const MDX_SNIPPETS: MdxSnippetDefinition[] = [
  { id: "h2", label: "Section Heading (H2)", shortLabel: "H2", group: "format", mode: "block" },
  { id: "bold", label: "Bold", shortLabel: "B", group: "format", mode: "wrap" },
  { id: "italic", label: "Italic", shortLabel: "I", group: "format", mode: "wrap" },
  { id: "inline-math", label: "Inline KaTeX ($...$)", shortLabel: "$x$", group: "math", mode: "wrap" },
  { id: "block-math", label: "Display Equation ($$...$$)", shortLabel: "$$", group: "math", mode: "block" },
  { id: "mermaid", label: "Mermaid Diagram", shortLabel: "Mermaid", group: "scientific", mode: "block" },
  { id: "callout", label: "Callout Box", shortLabel: "Callout", group: "scientific", mode: "block" },
  { id: "theorem", label: "Theorem & Proof", shortLabel: "Theorem", group: "scientific", mode: "block" },
  { id: "table", label: "Data Table", shortLabel: "Table", group: "scientific", mode: "block" },
  { id: "code", label: "Code Block", shortLabel: "Code", group: "scientific", mode: "block" },
  { id: "stats", label: "Stat Highlight", shortLabel: "Stats", group: "scientific", mode: "block" },
];

export interface InsertionResult {
  nextText: string;
  selectionStart: number;
  selectionEnd: number;
}

function getWrapSpec(id: MdxSnippetId, locale: "fa" | "en"): { prefix: string; suffix: string; placeholder: string } | null {
  switch (id) {
    case "bold":
      return { prefix: "**", suffix: "**", placeholder: locale === "fa" ? "متن پررنگ" : "bold text" };
    case "italic":
      return { prefix: "*", suffix: "*", placeholder: locale === "fa" ? "متن مورب" : "italic text" };
    case "inline-math":
      return { prefix: "$", suffix: "$", placeholder: "E = mc^2" };
    default:
      return null;
  }
}

function getBlockTemplate(id: MdxSnippetId, locale: "fa" | "en", selected: string): { text: string; selectOffset: number; selectLength: number } {
  const isFa = locale === "fa";

  switch (id) {
    case "h2": {
      const heading = selected || (isFa ? "عنوان بخش جدید" : "New Section Heading");
      const text = `## ${heading}`;
      return { text, selectOffset: 3, selectLength: heading.length };
    }
    case "block-math": {
      const expr = selected || "R_{\\mu\\nu} - \\frac{1}{2} R g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}";
      const text = `$$\n${expr}\n$$`;
      return { text, selectOffset: 3, selectLength: expr.length };
    }
    case "mermaid": {
      const body = selected || "graph LR\n  A[Hypothesis] --> B[Experiment]\n  B --> C[Peer Review]";
      const text = `\`\`\`mermaid\n${body}\n\`\`\``;
      return { text, selectOffset: 11, selectLength: body.length };
    }
    case "callout": {
      const title = isFa ? "نکته کلیدی" : "Key Insight";
      const body = selected || (isFa ? "توضیح علمی مهم را اینجا بنویسید." : "Write a concise scientific takeaway here.");
      const text = `<Callout type="info" title="${title}">\n${body}\n</Callout>`;
      return { text, selectOffset: text.indexOf(body), selectLength: body.length };
    }
    case "theorem": {
      const body =
        selected ||
        (isFa
          ? "برای هر فضای هیلبرت جدایی‌پذیر $\\mathcal{H}$، پایه متعامد یکه شمارا وجود دارد."
          : "For every separable Hilbert space $\\mathcal{H}$, there exists a countable orthonormal basis.");
      const text = isFa
        ? `<Theorem label="قضیه" title="عنوان قضیه">\n${body}\n</Theorem>\n\n<Proof label="برهان.">\nمراحل اثبات را با استفاده از فرآیند گرام-اشمیت دنبال می‌کنیم.\n</Proof>`
        : `<Theorem title="Theorem Title">\n${body}\n</Theorem>\n\n<Proof>\nApply the Gram-Schmidt orthonormalization process to a countable dense subset.\n</Proof>`;
      return { text, selectOffset: text.indexOf(body), selectLength: body.length };
    }
    case "table": {
      const text = isFa
        ? `| پارامتر | مقدار | واحد |\n| --- | --- | --- |\n| ثابت پلانک | $6.626 \\times 10^{-34}$ | $\\text{J}\\cdot\\text{s}$ |\n| سرعت نور | $2.998 \\times 10^{8}$ | $\\text{m/s}$ |`
        : `| Parameter | Value | Unit |\n| --- | --- | --- |\n| Planck constant | $6.626 \\times 10^{-34}$ | $\\text{J}\\cdot\\text{s}$ |\n| Speed of light | $2.998 \\times 10^{8}$ | $\\text{m/s}$ |`;
      return { text, selectOffset: 0, selectLength: text.length };
    }
    case "code": {
      const body = selected || "import numpy as np\n\neigenvalues = np.linalg.eigvalsh(H)";
      const text = `\`\`\`python\n${body}\n\`\`\``;
      return { text, selectOffset: 10, selectLength: body.length };
    }
    case "stats": {
      const text = isFa
        ? `<StatHighlight stats={[\n  { value: "13.8B", label: "سن کیهان (سال)" },\n  { value: "99.9%", label: "دقت اندازه‌گیری" },\n  { value: "2.725 K", label: "دمای تابش زمینه" }\n]} />`
        : `<StatHighlight stats={[\n  { value: "13.8B", label: "Age of the Universe (yr)" },\n  { value: "99.9%", label: "Measurement Confidence" },\n  { value: "2.725 K", label: "CMB Temperature" }\n]} />`;
      return { text, selectOffset: 0, selectLength: text.length };
    }
    default:
      return { text: selected, selectOffset: 0, selectLength: selected.length };
  }
}

export function insertSnippetAtSelection(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  snippetId: MdxSnippetId,
  locale: "fa" | "en" = "en"
): InsertionResult {
  const safeStart = Math.max(0, Math.min(selectionStart, content.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, content.length));
  const before = content.slice(0, safeStart);
  const selected = content.slice(safeStart, safeEnd);
  const after = content.slice(safeEnd);

  const wrap = getWrapSpec(snippetId, locale);
  if (wrap) {
    const inner = selected || wrap.placeholder;
    const inserted = `${wrap.prefix}${inner}${wrap.suffix}`;
    const nextText = `${before}${inserted}${after}`;
    const nextStart = safeStart + wrap.prefix.length;
    return {
      nextText,
      selectionStart: nextStart,
      selectionEnd: nextStart + inner.length,
    };
  }

  const block = getBlockTemplate(snippetId, locale, selected);
  const needsLeadingBreak = before.length > 0 && !before.endsWith("\n\n");
  const leading = before.length === 0 ? "" : before.endsWith("\n") ? "\n" : needsLeadingBreak ? "\n\n" : "";
  const trailing = after.length === 0 ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const nextText = `${before}${leading}${block.text}${trailing}${after}`;
  const baseOffset = before.length + leading.length;

  return {
    nextText,
    selectionStart: baseOffset + block.selectOffset,
    selectionEnd: baseOffset + block.selectOffset + block.selectLength,
  };
}

function escapeJsxAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "&quot;").replace(/\r?\n/g, " ").trim();
}

export function buildFigureMdx(input: {
  src: string;
  alt: string;
  caption?: string;
  aspect?: "video" | "square" | "portrait" | "wide";
}): string {
  const src = escapeJsxAttr(input.src);
  const alt = escapeJsxAttr(input.alt || "Scientific figure");
  const caption = input.caption ? escapeJsxAttr(input.caption) : "";
  const aspectPart = input.aspect && input.aspect !== "video" ? ` aspect="${input.aspect}"` : "";
  const captionPart = caption ? ` caption="${caption}"` : "";
  return `<Figure src="${src}" alt="${alt}"${captionPart}${aspectPart} />`;
}

export function insertRawBlockAtSelection(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  blockText: string
): InsertionResult {
  const safeStart = Math.max(0, Math.min(selectionStart, content.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, content.length));
  const before = content.slice(0, safeStart);
  const after = content.slice(safeEnd);

  const leading = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trailing = after.length === 0 ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const nextText = `${before}${leading}${blockText}${trailing}${after}`;
  const nextCursor = before.length + leading.length + blockText.length;

  return {
    nextText,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
  };
}
