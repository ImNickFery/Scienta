import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { execute, queryOne } from "@/lib/db";
import { ensureAnalyticsTableReady } from "@/lib/analytics-store";
import { detectDeviceType, parseReferrerHost } from "@/lib/admin-analytics-pro";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/security";
import { recordApiMetric, recordPageLoadMetric } from "@/lib/performance-telemetry";

const trackSchema = z.object({
  slug: z.string().min(1).max(200),
  locale: z.enum(["fa", "en"]),
  referrer: z.string().max(500).optional(),
  perf: z
    .object({
      ttfbMs: z.number().min(0).max(60_000),
      fcpMs: z.number().min(0).max(60_000).nullable().optional(),
      domLoadMs: z.number().min(0).max(60_000),
    })
    .optional(),
});

/**
 * Privacy-first, zero-cookie article view collector.
 * Increments `articles.views` and records an aggregated daily pageview row
 * (locale, device class, referrer host — zero IP/PII stored) so the Admin
 * Analytics Hub surfaces live daily traffic trends.
 */
export async function POST(req: Request) {
  const startedAt = performance.now();
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin tracking rejected." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`public-track:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { slug, locale, referrer, perf } = parsed.data;

  try {
    await ensureAnalyticsTableReady();

    const row = await queryOne<{ article_id: string }>(
      `SELECT t.article_id
       FROM article_translations t
       JOIN articles a ON a.id = t.article_id
       WHERE t.locale = ? AND t.slug = ? AND a.deleted_at IS NULL AND a.status = 'published'
       LIMIT 1`,
      [locale, slug]
    );

    if (!row) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const siteHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const referrerHost = parseReferrerHost(referrer, siteHost);
    const deviceType = detectDeviceType(req.headers.get("user-agent"));
    const safePath = `/${locale}/articles/${slug}`.slice(0, 255);

    await execute(
      `INSERT INTO analytics_pageviews (id, article_id, locale, path, referrer_host, device_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid(), row.article_id, locale, safePath, referrerHost, deviceType]
    );

    if (perf) {
      recordPageLoadMetric({
        path: safePath,
        locale,
        ttfbMs: perf.ttfbMs,
        fcpMs: perf.fcpMs ?? null,
        domLoadMs: perf.domLoadMs,
        deviceType,
      });
    }

    recordApiMetric({
      route: "/api/public/track",
      method: "POST",
      status: 200,
      durationMs: performance.now() - startedAt,
      source: "server",
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Non-fatal: never disturb reader experience if analytics storage is momentarily busy.
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
