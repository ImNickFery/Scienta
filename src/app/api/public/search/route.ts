import { NextResponse } from "next/server";
import { isValidLocale } from "@/lib/i18n/config";
import { searchArticles, stripArticleContent } from "@/lib/content";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit(`search:${ip}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many search requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const url = new URL(req.url);
  const rawLocale = url.searchParams.get("locale") ?? "en";
  if (!isValidLocale(rawLocale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!q) {
    return NextResponse.json({ items: [], query: "" });
  }

  const matches = await searchArticles(rawLocale, q);
  return NextResponse.json(
    {
      items: matches.map(stripArticleContent),
      query: q,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
