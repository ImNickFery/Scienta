import type { RoleName } from "@/lib/rbac";

export interface UserMutationGuardInput {
  actorId: string;
  actorRole: string;
  targetId: string;
  targetCurrentRole: RoleName;
  targetCurrentStatus: "active" | "suspended";
  nextRole?: RoleName;
  nextStatus?: "active" | "suspended";
  deleting?: boolean;
  activeSuperAdminCount: number;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Pure RBAC safety guard ensuring an admin cannot lock themselves out or leave
 * the platform without any active `super_admin`.
 */
export function validateUserMutation(input: UserMutationGuardInput): GuardResult {
  if (input.actorRole !== "super_admin") {
    return { allowed: false, reason: "Only super_admin can modify user accounts." };
  }

  const isSelf = input.actorId === input.targetId;
  const effectiveRole = input.nextRole ?? input.targetCurrentRole;
  const effectiveStatus = input.nextStatus ?? input.targetCurrentStatus;

  if (isSelf && input.deleting) {
    return { allowed: false, reason: "You cannot delete your own account." };
  }
  if (isSelf && effectiveStatus === "suspended") {
    return { allowed: false, reason: "You cannot suspend your own account." };
  }
  if (isSelf && input.targetCurrentRole === "super_admin" && effectiveRole !== "super_admin") {
    return { allowed: false, reason: "You cannot demote your own super_admin role." };
  }

  const wasActiveSuper =
    input.targetCurrentRole === "super_admin" && input.targetCurrentStatus === "active";
  const willRemainActiveSuper =
    !input.deleting && effectiveRole === "super_admin" && effectiveStatus === "active";

  if (wasActiveSuper && !willRemainActiveSuper && input.activeSuperAdminCount <= 1) {
    return { allowed: false, reason: "At least one active super_admin account must remain." };
  }

  return { allowed: true };
}

export interface ApiTranslationRow {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  canonical_url?: string | null;
  twitter_card?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  canonicalUrl?: string | null;
  twitterCard?: string | null;
}

export interface EditorTranslationFields {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  twitterCard: string;
}

/** Maps snake_case DB translation rows (or camelCase payloads) cleanly to editor state. */
export function mapApiTranslationToEditorState(row?: ApiTranslationRow | null): EditorTranslationFields {
  return {
    title: row?.title ?? "",
    slug: row?.slug ?? "",
    excerpt: row?.excerpt ?? "",
    content: row?.content ?? "",
    seoTitle: row?.seoTitle ?? row?.seo_title ?? "",
    seoDescription: row?.seoDescription ?? row?.seo_description ?? "",
    seoKeywords: row?.seoKeywords ?? row?.seo_keywords ?? "",
    canonicalUrl: row?.canonicalUrl ?? row?.canonical_url ?? "",
    twitterCard: row?.twitterCard ?? row?.twitter_card ?? "summary_large_image",
  };
}

export interface RevisionDiffSummary {
  revisionWords: number;
  currentWords: number;
  wordDelta: number;
  changedLines: number;
}

/** Computes a lightweight word & line delta between current editor content and a revision snapshot. */
export function summarizeRevisionDiff(currentText: string, revisionText: string): RevisionDiffSummary {
  const countWords = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

  const currentLines = currentText.split(/\r?\n/);
  const revLines = revisionText.split(/\r?\n/);
  const maxLen = Math.max(currentLines.length, revLines.length);
  let changedLines = 0;
  for (let i = 0; i < maxLen; i += 1) {
    if ((currentLines[i] ?? "") !== (revLines[i] ?? "")) changedLines += 1;
  }

  const currentWords = countWords(currentText);
  const revisionWords = countWords(revisionText);

  return {
    revisionWords,
    currentWords,
    wordDelta: revisionWords - currentWords,
    changedLines,
  };
}
