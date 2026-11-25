import { NextResponse } from "next/server";
import { isValidLocale } from "@/lib/i18n/config";
import { getAllTagRecords, getRecentArticles, searchArticles } from "@/lib/content";
import { getAuthors, getFields } from "@/lib/taxonomy";
import { filterTaxonomyForPalette, type CommandPalettePayload } from "@/lib/command-palette";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit(`cmd-palette:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many search requests" }, { status: 429 });
  }

  const url = new URL(req.url);
  const rawLocale = url.searchParams.get("locale") ?? "en";
  if (!isValidLocale(rawLocale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);

  const [articlesRaw, fields, tags, authors] = await Promise.all([
    q ? searchArticles(rawLocale, q) : getRecentArticles(rawLocale, 4),
    getFields(),
    getAllTagRecords(),
    getAuthors(),
  ]);

  const articles = articlesRaw.slice(0, q ? 6 : 4).map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    field: a.field,
    fieldColor: a.fieldColor,
    authorName: a.authorName,
    readingTimeMinutes: a.readingTimeMinutes,
  }));

  const taxonomy = filterTaxonomyForPalette(q, rawLocale, fields, tags, authors, {
    fields: q ? 5 : 4,
    tags: q ? 6 : 4,
    authors: q ? 4 : 0,
  });

  const payload: CommandPalettePayload = {
    query: q,
    articles,
    fields: taxonomy.fields,
    tags: taxonomy.tags,
    authors: taxonomy.authors,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
