import type { Metadata } from "next";
import { getAllArticles } from "@/lib/content";
import { getFields, type FieldRecord } from "@/lib/taxonomy";
import { NotFoundView, type NotFoundArticleSummary } from "@/components/not-found/not-found-view";
import type { Article } from "@/types";

export const metadata: Metadata = {
  title: "404",
  robots: { index: false, follow: true },
};

function toSummary(article: Article): NotFoundArticleSummary {
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    field: article.field,
    fieldColor: article.fieldColor,
    readingTimeMinutes: article.readingTimeMinutes,
  };
}

export default async function NotFound() {
  let faArticles: NotFoundArticleSummary[] = [];
  let enArticles: NotFoundArticleSummary[] = [];
  let fields: FieldRecord[] = [];

  try {
    const [faAll, enAll, allFields] = await Promise.all([
      getAllArticles("fa"),
      getAllArticles("en"),
      getFields(),
    ]);
    faArticles = faAll.slice(0, 3).map(toSummary);
    enArticles = enAll.slice(0, 3).map(toSummary);
    fields = allFields;
  } catch {
    // Keep 404 resilient even if the database is temporarily unreachable.
  }

  return (
    <NotFoundView
      articlesByLocale={{ fa: faArticles, en: enArticles }}
      fields={fields}
    />
  );
}
