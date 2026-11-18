import { ImageResponse } from "next/og";
import { isValidLocale } from "@/lib/i18n/config";
import { getArticle } from "@/lib/content";
import { getFieldBySlug } from "@/lib/taxonomy";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ArticleOpengraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : "en";
  const article = await getArticle(locale, slug);
  const field = article ? await getFieldBySlug(article.field) : null;
  const accent = field?.color ?? "#7B3FFB";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#05050A",
          backgroundImage:
            `radial-gradient(circle at 15% 10%, ${accent}55 0%, rgba(5,5,10,0) 55%), ` +
            "radial-gradient(circle at 90% 90%, rgba(255,60,90,0.25) 0%, rgba(5,5,10,0) 55%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #7B3FFB 0%, #FF3C5A 100%)",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
                fill="white"
              />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#f5f5fa", fontFamily: "sans-serif" }}>
            Scienta
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {field && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "8px 20px",
                borderRadius: 999,
                fontSize: 24,
                color: accent,
                background: `${accent}22`,
                fontFamily: "sans-serif",
              }}
            >
              {field.name.en}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#f5f5fa",
              maxWidth: 1000,
              fontFamily: "sans-serif",
            }}
          >
            {article?.title ?? "Scienta"}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
