import { NextResponse } from "next/server";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getAllArticles } from "@/lib/content";
import { buildRssFeed } from "@/lib/rss";

export const revalidate = 300;

export async function GET(
  _req: Request,
  context: { params: Promise<{ locale: string }> }
) {
  const { locale: rawLocale } = await context.params;
  if (!isValidLocale(rawLocale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 404 });
  }

  const locale = rawLocale as Locale;
  const articles = await getAllArticles(locale);
  const xml = buildRssFeed({ locale, articles });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
