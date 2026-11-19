export type CommentStatus = "pending" | "approved" | "rejected";

export type CommentSegment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

const MAX_MATH_SEGMENTS = 24;
const MAX_MATH_EXPR_LENGTH = 500;

export function isValidCommentStatus(value: unknown): value is CommentStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

/**
 * Safely tokenizes a reader comment into plain text segments and KaTeX math
 * segments (`$$...$$` for display math, `$...$` for inline math).
 *
 * Plain text is always rendered as React text nodes (never innerHTML), while
 * math segments are rendered exclusively through KaTeX with `trust: false`.
 */
export function parseCommentMathSegments(input: string): CommentSegment[] {
  if (!input) return [];

  const segments: CommentSegment[] = [];
  let textBuf = "";
  let mathCount = 0;
  let i = 0;

  const flushText = () => {
    if (textBuf) {
      segments.push({ type: "text", value: textBuf });
      textBuf = "";
    }
  };

  while (i < input.length) {
    // Escaped dollar sign: \$ -> literal $
    if (input[i] === "\\" && input[i + 1] === "$") {
      textBuf += "$";
      i += 2;
      continue;
    }

    if (input[i] === "$" && mathCount < MAX_MATH_SEGMENTS) {
      const isDisplay = input[i + 1] === "$";
      const delimiter = isDisplay ? "$$" : "$";
      const start = i + delimiter.length;

      // Inline math shouldn't open with whitespace (e.g. "$ 50 and $ 60")
      if (!isDisplay && (start >= input.length || /\s/.test(input[start]))) {
        textBuf += "$";
        i += 1;
        continue;
      }

      let end = -1;
      let cursor = start;
      while (cursor < input.length) {
        if (input[cursor] === "\\" && input[cursor + 1] === "$") {
          cursor += 2;
          continue;
        }
        if (isDisplay && input[cursor] === "$" && input[cursor + 1] === "$") {
          end = cursor;
          break;
        }
        if (!isDisplay && input[cursor] === "$") {
          // Inline math cannot cross a blank line or end with whitespace before $
          if (cursor > start && !/\s/.test(input[cursor - 1])) {
            end = cursor;
          }
          break;
        }
        if (!isDisplay && input[cursor] === "\n") {
          break;
        }
        cursor += 1;
      }

      if (end !== -1) {
        const expr = input.slice(start, end).trim();
        if (expr.length > 0 && expr.length <= MAX_MATH_EXPR_LENGTH) {
          flushText();
          segments.push({ type: "math", value: expr, display: isDisplay });
          mathCount += 1;
          i = end + delimiter.length;
          continue;
        }
      }
    }

    textBuf += input[i];
    i += 1;
  }

  flushText();
  return segments;
}

export interface CommentSubmissionInput {
  articleId?: unknown;
  locale?: unknown;
  name?: unknown;
  email?: unknown;
  content?: unknown;
  isQuestion?: unknown;
  website?: unknown;
}

export type CommentValidationResult =
  | {
      ok: true;
      data: {
        articleId: string;
        locale: "fa" | "en";
        name: string;
        email: string;
        content: string;
        isQuestion: boolean;
      };
    }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCommentSubmission(input: CommentSubmissionInput): CommentValidationResult {
  // Honeypot field: reject silently/clearly if populated by bots
  if (typeof input.website === "string" && input.website.trim().length > 0) {
    return { ok: false, error: "Invalid submission" };
  }

  const articleId = typeof input.articleId === "string" ? input.articleId.trim() : "";
  if (!articleId || articleId.length > 100) {
    return { ok: false, error: "Missing article identifier" };
  }

  const locale = input.locale === "en" ? "en" : "fa";

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: "Name must be between 2 and 120 characters" };
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email || email.length > 190 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please provide a valid email address" };
  }

  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (content.length < 5 || content.length > 2500) {
    return { ok: false, error: "Comment must be between 5 and 2500 characters" };
  }

  return {
    ok: true,
    data: {
      articleId,
      locale,
      name,
      email,
      content,
      isQuestion: Boolean(input.isQuestion),
    },
  };
}
