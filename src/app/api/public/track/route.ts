import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { execute, queryOne } from "@/lib/db";
import { ensureAnalyticsTableReady } from "@/lib/analytics-store";
import {
  buildPrivacyVisitorHash,
  classifyTrafficSource,
  detectCountryInfo,
  isBotUserAgent,
  normalizeBrowserLanguage,
  parseBrowserInfo,
  parseDeviceInfo,
  parseOsInfo,
} from "@/lib/visitor-telemetry";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/security";
import { recordApiMetric, recordPageLoadMetric } from "@/lib/performance-telemetry";

const EPHEMERAL_VISITOR_SALT = randomBytes(32).toString("hex");

function getVisitorHashSecret(): string {
  return process.env.JWT_SECRET?.trim() || EPHEMERAL_VISITOR_SALT;
}

const trackSchema = z
  .object({
    slug: z.string().min(1).max(200).optional(),
    path: z
      .string()
      .min(1)
      .max(255)
      .refine((v) => v.startsWith("/") && !/[\r\n\x00-\x1f]/.test(v), "Invalid path")
      .optional(),
    locale: z.enum(["fa", "en"]),
    referrer: z.string().max(600).optional(),
    timezone: z.string().max(64).optional(),
    screenWidth: z.number().int().min(100).max(10_000).optional(),
    language: z.string().max(32).optional(),
    utmSource: z.string().max(80).optional(),
    utmMedium: z.string().max(80).optional(),
    utmCampaign: z.string().max(80).optional(),
    perf: z
      .object({
        ttfbMs: z.number().min(0).max(60_000),
        fcpMs: z.number().min(0).max(60_000).nullable().optional(),
        domLoadMs: z.number().min(0).max(60_000),
      })
      .optional(),
  })
  .refine((d) => Boolean(d.slug || d.path), {
    message: "Either slug or path is required",
  });

/**
 * Privacy-first, zero-cookie site-wide & article telemetry collector.
 * Extracts country/region (edge headers -> IANA timezone), acquisition channel,
 * search/AI engine, browser/OS/device class, screen tier, and daily-salted
 * visitor hash (zero raw IP/PII stored).
 */
export async function POST(req: Request) {
  const startedAt = performance.now();
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin tracking rejected." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`public-track:${ip}`, 90, 60_000);
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

  const {
    slug,
    path: rawPath,
    locale,
    referrer,
    timezone,
    screenWidth,
    language,
    utmSource,
    utmMedium,
    utmCampaign,
    perf,
  } = parsed.data;

  try {
    await ensureAnalyticsTableReady();

    let articleId: string | null = null;
    let safePath = rawPath ? rawPath.split("?")[0].slice(0, 255) : `/${locale}`;

    if (slug) {
      const row = await queryOne<{ article_id: string }>(
        `SELECT t.article_id
         FROM article_translations t
         JOIN articles a ON a.id = t.article_id
         WHERE t.locale = ? AND t.slug = ? AND a.deleted_at IS NULL
           AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= NOW()))
         LIMIT 1`,
        [locale, slug]
      );

      if (!row) {
        return NextResponse.json({ ok: false }, { status: 404 });
      }
      articleId = row.article_id;
      safePath = `/${locale}/articles/${slug}`.slice(0, 255);
    } else if (safePath.startsWith("/admin") || safePath.startsWith("/api")) {
      // Never track admin or API paths as public readership
      return NextResponse.json({ ok: true });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const siteHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const source = classifyTrafficSource({
      referrer,
      siteHost,
      utmSource,
      utmMedium,
      utmCampaign,
    });
    const geo = detectCountryInfo({
      headers: req.headers,
      timezone,
    });
    const browser = parseBrowserInfo(userAgent);
    const os = parseOsInfo(userAgent);
    const device = parseDeviceInfo(userAgent, screenWidth);
    const browserLang = normalizeBrowserLanguage(language || req.headers.get("accept-language"));
    const isBot = isBotUserAgent(userAgent) ? 1 : 0;

    const utcDay = new Date().toISOString().slice(0, 10);
    const visitorHash = buildPrivacyVisitorHash(ip, userAgent, utcDay, getVisitorHashSecret());

    await execute(
      `INSERT INTO analytics_pageviews (
        id, article_id, locale, path, referrer_host, device_type,
        country_code, country_name, city, region_name, timezone,
        traffic_channel, search_engine,
        browser_name, browser_version, os_name, os_version,
        device_vendor, screen_bucket, browser_lang,
        utm_source, utm_medium, utm_campaign,
        visitor_hash, is_bot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        articleId,
        locale,
        safePath,
        source.referrerHost,
        device.deviceType,
        geo.countryCode,
        geo.countryName,
        geo.city,
        geo.regionName,
        geo.timezone,
        source.channel,
        source.searchEngine,
        browser.name,
        browser.version,
        os.name,
        os.version,
        device.vendor,
        device.screenBucket,
        browserLang,
        source.utmSource,
        source.utmMedium,
        source.utmCampaign,
        visitorHash,
        isBot,
      ]
    );

    if (perf) {
      recordPageLoadMetric({
        path: safePath,
        locale,
        ttfbMs: perf.ttfbMs,
        fcpMs: perf.fcpMs ?? null,
        domLoadMs: perf.domLoadMs,
        deviceType: device.deviceType,
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
