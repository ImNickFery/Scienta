export type FieldSlug =
  | "physics"
  | "astronomy"
  | "ai"
  | "space"
  | "quantum"
  | "math"
  | "biology"
  | "medicine"
  | "engineering"
  | "technology";

export interface Author {
  slug: string;
  name: { fa: string; en: string };
  title: { fa: string; en: string };
  bio: { fa: string; en: string };
  avatar: string;
  social?: { twitter?: string; website?: string; orcid?: string };
}

export interface ArticleFrontmatter {
  id: string;
  slug: string;
  locale: "fa" | "en";
  title: string;
  excerpt: string;
  cover: string;
  field: FieldSlug;
  fieldColor: string;
  tags: string[];
  authorSlug: string;
  authorName: string;
  publishedAt: string;
  updatedAt?: string;
  views: number;
  featured?: boolean;
  trending?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  canonicalUrl?: string;
  twitterCard?: "summary" | "summary_large_image";
}

export interface Article extends ArticleFrontmatter {
  content: string;
  readingTimeMinutes: number;
}

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}
