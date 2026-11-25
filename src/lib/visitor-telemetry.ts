import { createHash } from "node:crypto";
import { parseReferrerHost, type DeviceType } from "./admin-analytics-pro";

export type TrafficChannel =
  | "search"
  | "ai_search"
  | "social"
  | "campaign"
  | "referral"
  | "direct";

export type RegionCode = "ME" | "EU" | "NA" | "AS" | "OC" | "SA" | "AF" | "UN";

export interface CountryMeta {
  code: string;
  nameEn: string;
  nameFa: string;
  region: RegionCode;
  /** Approximate lon/lat centroid for the interactive telemetry map */
  lon: number;
  lat: number;
}

export const COUNTRY_CATALOG: Record<string, CountryMeta> = {
  IR: { code: "IR", nameEn: "Iran", nameFa: "ایران", region: "ME", lon: 53.7, lat: 32.4 },
  US: { code: "US", nameEn: "United States", nameFa: "ایالات متحده", region: "NA", lon: -98.5, lat: 39.8 },
  DE: { code: "DE", nameEn: "Germany", nameFa: "آلمان", region: "EU", lon: 10.4, lat: 51.2 },
  CA: { code: "CA", nameEn: "Canada", nameFa: "کانادا", region: "NA", lon: -106.3, lat: 56.1 },
  GB: { code: "GB", nameEn: "United Kingdom", nameFa: "بریتانیا", region: "EU", lon: -3.4, lat: 55.4 },
  NL: { code: "NL", nameEn: "Netherlands", nameFa: "هلند", region: "EU", lon: 5.3, lat: 52.1 },
  FR: { code: "FR", nameEn: "France", nameFa: "فرانسه", region: "EU", lon: 2.2, lat: 46.2 },
  TR: { code: "TR", nameEn: "Turkey", nameFa: "ترکیه", region: "ME", lon: 35.2, lat: 39.0 },
  AE: { code: "AE", nameEn: "United Arab Emirates", nameFa: "امارات متحده عربی", region: "ME", lon: 53.8, lat: 23.4 },
  SE: { code: "SE", nameEn: "Sweden", nameFa: "سوئد", region: "EU", lon: 18.6, lat: 60.1 },
  AU: { code: "AU", nameEn: "Australia", nameFa: "استرالیا", region: "OC", lon: 133.8, lat: -25.3 },
  IT: { code: "IT", nameEn: "Italy", nameFa: "ایتالیا", region: "EU", lon: 12.6, lat: 41.9 },
  ES: { code: "ES", nameEn: "Spain", nameFa: "اسپانیا", region: "EU", lon: -3.7, lat: 40.5 },
  CH: { code: "CH", nameEn: "Switzerland", nameFa: "سوئیس", region: "EU", lon: 8.2, lat: 46.8 },
  AT: { code: "AT", nameEn: "Austria", nameFa: "اتریش", region: "EU", lon: 14.6, lat: 47.5 },
  FI: { code: "FI", nameEn: "Finland", nameFa: "فنلاند", region: "EU", lon: 25.7, lat: 61.9 },
  NO: { code: "NO", nameEn: "Norway", nameFa: "نروژ", region: "EU", lon: 8.5, lat: 60.5 },
  DK: { code: "DK", nameEn: "Denmark", nameFa: "دانمارک", region: "EU", lon: 9.5, lat: 56.3 },
  BE: { code: "BE", nameEn: "Belgium", nameFa: "بلژیک", region: "EU", lon: 4.5, lat: 50.5 },
  PL: { code: "PL", nameEn: "Poland", nameFa: "لهستان", region: "EU", lon: 19.1, lat: 51.9 },
  RU: { code: "RU", nameEn: "Russia", nameFa: "روسیه", region: "EU", lon: 94.0, lat: 61.5 },
  IN: { code: "IN", nameEn: "India", nameFa: "هند", region: "AS", lon: 78.9, lat: 20.6 },
  CN: { code: "CN", nameEn: "China", nameFa: "چین", region: "AS", lon: 104.2, lat: 35.9 },
  JP: { code: "JP", nameEn: "Japan", nameFa: "ژاپن", region: "AS", lon: 138.3, lat: 36.2 },
  KR: { code: "KR", nameEn: "South Korea", nameFa: "کره جنوبی", region: "AS", lon: 127.8, lat: 35.9 },
  SG: { code: "SG", nameEn: "Singapore", nameFa: "سنگاپور", region: "AS", lon: 103.8, lat: 1.35 },
  MY: { code: "MY", nameEn: "Malaysia", nameFa: "مالزی", region: "AS", lon: 101.9, lat: 4.2 },
  ID: { code: "ID", nameEn: "Indonesia", nameFa: "اندونزی", region: "AS", lon: 113.9, lat: -0.8 },
  PK: { code: "PK", nameEn: "Pakistan", nameFa: "پاکستان", region: "AS", lon: 69.3, lat: 30.4 },
  AF: { code: "AF", nameEn: "Afghanistan", nameFa: "افغانستان", region: "ME", lon: 67.7, lat: 33.9 },
  IQ: { code: "IQ", nameEn: "Iraq", nameFa: "عراق", region: "ME", lon: 43.7, lat: 33.2 },
  SA: { code: "SA", nameEn: "Saudi Arabia", nameFa: "عربستان سعودی", region: "ME", lon: 45.1, lat: 23.9 },
  QA: { code: "QA", nameEn: "Qatar", nameFa: "قطر", region: "ME", lon: 51.2, lat: 25.4 },
  OM: { code: "OM", nameEn: "Oman", nameFa: "عمان", region: "ME", lon: 55.9, lat: 21.5 },
  KW: { code: "KW", nameEn: "Kuwait", nameFa: "کویت", region: "ME", lon: 47.5, lat: 29.3 },
  AZ: { code: "AZ", nameEn: "Azerbaijan", nameFa: "آذربایجان", region: "ME", lon: 47.6, lat: 40.1 },
  AM: { code: "AM", nameEn: "Armenia", nameFa: "ارمنستان", region: "ME", lon: 45.0, lat: 40.1 },
  GE: { code: "GE", nameEn: "Georgia", nameFa: "گرجستان", region: "ME", lon: 43.4, lat: 42.3 },
  TJ: { code: "TJ", nameEn: "Tajikistan", nameFa: "تاجیکستان", region: "AS", lon: 71.3, lat: 38.9 },
  BR: { code: "BR", nameEn: "Brazil", nameFa: "برزیل", region: "SA", lon: -51.9, lat: -14.2 },
  MX: { code: "MX", nameEn: "Mexico", nameFa: "مکزیک", region: "NA", lon: -102.6, lat: 23.6 },
  AR: { code: "AR", nameEn: "Argentina", nameFa: "آرژانتین", region: "SA", lon: -63.6, lat: -38.4 },
  ZA: { code: "ZA", nameEn: "South Africa", nameFa: "آفریقای جنوبی", region: "AF", lon: 22.9, lat: -30.6 },
  EG: { code: "EG", nameEn: "Egypt", nameFa: "مصر", region: "AF", lon: 30.8, lat: 26.8 },
  NZ: { code: "NZ", nameEn: "New Zealand", nameFa: "نیوزیلند", region: "OC", lon: 174.9, lat: -40.9 },
  IE: { code: "IE", nameEn: "Ireland", nameFa: "ایرلند", region: "EU", lon: -8.2, lat: 53.4 },
  PT: { code: "PT", nameEn: "Portugal", nameFa: "پرتغال", region: "EU", lon: -8.2, lat: 39.4 },
  CZ: { code: "CZ", nameEn: "Czechia", nameFa: "جمهوری چک", region: "EU", lon: 15.5, lat: 49.8 },
  GR: { code: "GR", nameEn: "Greece", nameFa: "یونان", region: "EU", lon: 21.8, lat: 39.1 },
  RO: { code: "RO", nameEn: "Romania", nameFa: "رومانی", region: "EU", lon: 25.0, lat: 45.9 },
  UA: { code: "UA", nameEn: "Ukraine", nameFa: "اوکراین", region: "EU", lon: 31.2, lat: 48.4 },
  TW: { code: "TW", nameEn: "Taiwan", nameFa: "تایوان", region: "AS", lon: 121.0, lat: 23.7 },
  HK: { code: "HK", nameEn: "Hong Kong", nameFa: "هنگ‌کنگ", region: "AS", lon: 114.2, lat: 22.3 },
  VN: { code: "VN", nameEn: "Vietnam", nameFa: "ویتنام", region: "AS", lon: 108.3, lat: 14.1 },
  TH: { code: "TH", nameEn: "Thailand", nameFa: "تایلند", region: "AS", lon: 101.0, lat: 15.9 },
};

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "asia/tehran": "IR",
  "iran": "IR",
  "america/new_york": "US",
  "america/los_angeles": "US",
  "america/chicago": "US",
  "america/denver": "US",
  "america/phoenix": "US",
  "america/detroit": "US",
  "america/anchorage": "US",
  "pacific/honolulu": "US",
  "us/eastern": "US",
  "us/pacific": "US",
  "us/central": "US",
  "us/mountain": "US",
  "america/toronto": "CA",
  "america/vancouver": "CA",
  "america/montreal": "CA",
  "america/edmonton": "CA",
  "america/winnipeg": "CA",
  "america/halifax": "CA",
  "europe/berlin": "DE",
  "europe/munich": "DE",
  "europe/frankfurt": "DE",
  "europe/london": "GB",
  "europe/amsterdam": "NL",
  "europe/paris": "FR",
  "europe/istanbul": "TR",
  "asia/istanbul": "TR",
  "asia/dubai": "AE",
  "europe/stockholm": "SE",
  "australia/sydney": "AU",
  "australia/melbourne": "AU",
  "australia/brisbane": "AU",
  "australia/perth": "AU",
  "europe/rome": "IT",
  "europe/madrid": "ES",
  "europe/zurich": "CH",
  "europe/vienna": "AT",
  "europe/helsinki": "FI",
  "europe/oslo": "NO",
  "europe/copenhagen": "DK",
  "europe/brussels": "BE",
  "europe/warsaw": "PL",
  "europe/moscow": "RU",
  "asia/kolkata": "IN",
  "asia/calcutta": "IN",
  "asia/shanghai": "CN",
  "asia/chongqing": "CN",
  "asia/tokyo": "JP",
  "asia/seoul": "KR",
  "asia/singapore": "SG",
  "asia/kuala_lumpur": "MY",
  "asia/jakarta": "ID",
  "asia/karachi": "PK",
  "asia/kabul": "AF",
  "asia/baghdad": "IQ",
  "asia/riyadh": "SA",
  "asia/qatar": "QA",
  "asia/muscat": "OM",
  "asia/kuwait": "KW",
  "asia/baku": "AZ",
  "asia/yerevan": "AM",
  "asia/tbilisi": "GE",
  "asia/dushanbe": "TJ",
  "america/sao_paulo": "BR",
  "america/mexico_city": "MX",
  "america/argentina/buenos_aires": "AR",
  "africa/johannesburg": "ZA",
  "africa/cairo": "EG",
  "pacific/auckland": "NZ",
  "europe/dublin": "IE",
  "europe/lisbon": "PT",
  "europe/prague": "CZ",
  "europe/athens": "GR",
  "europe/bucharest": "RO",
  "europe/kyiv": "UA",
  "europe/kiev": "UA",
  "asia/taipei": "TW",
  "asia/hong_kong": "HK",
  "asia/ho_chi_minh": "VN",
  "asia/bangkok": "TH",
};

export function getCountryMeta(code: string | null | undefined): CountryMeta {
  const normalized = (code || "").trim().toUpperCase();
  if (normalized && COUNTRY_CATALOG[normalized]) {
    return COUNTRY_CATALOG[normalized];
  }
  if (/^[A-Z]{2}$/.test(normalized) && normalized !== "XX" && normalized !== "ZZ") {
    return {
      code: normalized,
      nameEn: normalized,
      nameFa: normalized,
      region: "UN",
      lon: 0,
      lat: 20,
    };
  }
  return {
    code: "ZZ",
    nameEn: "Unknown",
    nameFa: "نامشخص",
    region: "UN",
    lon: 0,
    lat: 0,
  };
}

export interface DetectedGeoInfo {
  countryCode: string;
  countryName: string;
  city: string | null;
  regionName: string | null;
  timezone: string | null;
  geoSource: "edge-header" | "timezone" | "unknown";
}

function sanitizeHeaderValue(raw: string | null | undefined, maxLen = 80): string | null {
  if (!raw) return null;
  let decoded = raw.trim();
  if (!decoded) return null;
  try {
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // Keep original string if percent decoding fails
  }
  const clean = decoded.replace(/[\r\n\t\x00-\x1f]/g, " ").trim().slice(0, maxLen);
  return clean || null;
}

/**
 * Resolves visitor country from trusted CDN/reverse-proxy headers first
 * (Cloudflare, Vercel, GCP/AppEngine, GeoIP nginx), then falls back to the
 * browser's IANA timezone when running behind proxies without GeoIP headers.
 */
export function detectCountryInfo(input: {
  headers: Pick<Headers, "get">;
  timezone?: string | null;
}): DetectedGeoInfo {
  const countryHeaders = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-appengine-country",
    "x-country-code",
    "geoip-country-code",
    "x-geo-country",
  ];

  const cleanTz = sanitizeHeaderValue(input.timezone, 64);
  const rawCity =
    sanitizeHeaderValue(input.headers.get("cf-ipcity")) ||
    sanitizeHeaderValue(input.headers.get("x-vercel-ip-city")) ||
    sanitizeHeaderValue(input.headers.get("x-appengine-city")) ||
    sanitizeHeaderValue(input.headers.get("x-geo-city"));
  const rawRegion =
    sanitizeHeaderValue(input.headers.get("cf-region")) ||
    sanitizeHeaderValue(input.headers.get("x-vercel-ip-country-region")) ||
    sanitizeHeaderValue(input.headers.get("x-appengine-region"));

  for (const h of countryHeaders) {
    const val = (input.headers.get(h) || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(val) && val !== "XX" && val !== "T1" && val !== "ZZ") {
      const meta = getCountryMeta(val);
      return {
        countryCode: meta.code,
        countryName: meta.nameEn,
        city: rawCity,
        regionName: rawRegion,
        timezone: cleanTz,
        geoSource: "edge-header",
      };
    }
  }

  if (cleanTz) {
    const tzCode = TIMEZONE_TO_COUNTRY[cleanTz.toLowerCase()];
    if (tzCode) {
      const meta = getCountryMeta(tzCode);
      return {
        countryCode: meta.code,
        countryName: meta.nameEn,
        city: rawCity,
        regionName: rawRegion,
        timezone: cleanTz,
        geoSource: "timezone",
      };
    }
  }

  return {
    countryCode: "ZZ",
    countryName: "Unknown",
    city: rawCity,
    regionName: rawRegion,
    timezone: cleanTz,
    geoSource: "unknown",
  };
}

export interface BrowserInfo {
  name: string;
  version: string;
}

export interface OsInfo {
  name: string;
  version: string;
}

export interface DeviceInfo {
  deviceType: DeviceType;
  vendor: string;
  screenBucket: string;
}

const BOT_PATTERN =
  /bot\b|crawler|spider|slurp|mediapartners|facebookexternalhit|bingpreview|whatsapp|telegrambot|discordbot|linkedinbot|applebot|duckduckbot|yandexbot|baiduspider|ahrefsbot|semrushbot|mj12bot|dotbot|gptbot|claudebot|perplexitybot|bytespider|curl\/|wget\/|python-requests|go-http-client|headlesschrome|lighthouse/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_PATTERN.test(userAgent);
}

export function parseBrowserInfo(userAgent: string | null | undefined): BrowserInfo {
  if (!userAgent || !userAgent.trim()) {
    return { name: "Unknown", version: "" };
  }
  const ua = userAgent;

  // In-App WebViews commonly seen in Persian/global reader traffic
  if (/Telegram/i.test(ua)) return { name: "Telegram", version: "" };
  if (/Instagram/i.test(ua)) return { name: "Instagram", version: "" };

  const matchVersion = (regex: RegExp): string => {
    const m = regex.exec(ua);
    return m?.[1] ? m[1].split(".")[0] : "";
  };

  if (/SamsungBrowser\/([\d.]+)/i.test(ua)) {
    return { name: "Samsung Internet", version: matchVersion(/SamsungBrowser\/([\d.]+)/i) };
  }
  if (/EdgA?\/([\d.]+)|EdgiOS\/([\d.]+)/i.test(ua)) {
    return { name: "Edge", version: matchVersion(/(?:EdgA?|EdgiOS)\/([\d.]+)/i) };
  }
  if (/OPR\/([\d.]+)|Opera\/([\d.]+)/i.test(ua)) {
    return { name: "Opera", version: matchVersion(/(?:OPR|Opera)\/([\d.]+)/i) };
  }
  if (/YaBrowser\/([\d.]+)/i.test(ua)) {
    return { name: "Yandex Browser", version: matchVersion(/YaBrowser\/([\d.]+)/i) };
  }
  if (/Vivaldi\/([\d.]+)/i.test(ua)) {
    return { name: "Vivaldi", version: matchVersion(/Vivaldi\/([\d.]+)/i) };
  }
  if (/Brave\/([\d.]+)|\bBrave\b/i.test(ua)) {
    return { name: "Brave", version: matchVersion(/(?:Brave|Chrome)\/([\d.]+)/i) };
  }
  if (/UCBrowser\/([\d.]+)/i.test(ua)) {
    return { name: "UC Browser", version: matchVersion(/UCBrowser\/([\d.]+)/i) };
  }
  if (/Firefox\/([\d.]+)|FxiOS\/([\d.]+)/i.test(ua)) {
    return { name: "Firefox", version: matchVersion(/(?:Firefox|FxiOS)\/([\d.]+)/i) };
  }
  if (/CriOS\/([\d.]+)|Chrome\/([\d.]+)/i.test(ua)) {
    return { name: "Chrome", version: matchVersion(/(?:CriOS|Chrome)\/([\d.]+)/i) };
  }
  if (/Safari\/([\d.]+)/i.test(ua) && /Version\/([\d.]+)/i.test(ua)) {
    return { name: "Safari", version: matchVersion(/Version\/([\d.]+)/i) };
  }
  if (/Safari\//i.test(ua)) {
    return { name: "Safari", version: "" };
  }

  return { name: "Other", version: "" };
}

export function parseOsInfo(userAgent: string | null | undefined): OsInfo {
  if (!userAgent || !userAgent.trim()) {
    return { name: "Unknown", version: "" };
  }
  const ua = userAgent;

  const androidMatch = /Android\s+([\d.]+)/i.exec(ua);
  if (androidMatch) {
    return { name: "Android", version: androidMatch[1].split(".")[0] };
  }
  if (/iPad/i.test(ua)) {
    const v = /OS\s+([\d_]+)/i.exec(ua)?.[1]?.split("_")[0] ?? "";
    return { name: "iPadOS", version: v };
  }
  if (/iPhone|iPod/i.test(ua)) {
    const v = /OS\s+([\d_]+)/i.exec(ua)?.[1]?.split("_")[0] ?? "";
    return { name: "iOS", version: v };
  }
  const winMatch = /Windows NT\s+([\d.]+)/i.exec(ua);
  if (winMatch) {
    const nt = winMatch[1];
    const label =
      nt === "10.0" ? "10/11" : nt === "6.3" ? "8.1" : nt === "6.2" ? "8" : nt === "6.1" ? "7" : nt;
    return { name: "Windows", version: label };
  }
  if (/CrOS/i.test(ua)) {
    return { name: "ChromeOS", version: "" };
  }
  const macMatch = /Mac OS X\s+([\d_]+)/i.exec(ua);
  if (macMatch) {
    const parts = macMatch[1].split("_");
    return { name: "macOS", version: parts.slice(0, 2).join(".") };
  }
  if (/Linux/i.test(ua)) {
    return { name: "Linux", version: "" };
  }
  return { name: "Other", version: "" };
}

export function bucketScreenWidth(width: number | null | undefined): string {
  if (!width || !Number.isFinite(width) || width <= 0) return "Unknown";
  if (width < 640) return "Mobile (<640px)";
  if (width < 1024) return "Tablet (640-1024px)";
  if (width < 1440) return "Laptop (1024-1440px)";
  if (width < 1920) return "Desktop (1440-1920px)";
  return "Wide (1920px+)";
}

export function parseDeviceInfo(
  userAgent: string | null | undefined,
  screenWidth?: number | null
): DeviceInfo {
  const ua = userAgent || "";
  const lower = ua.toLowerCase();

  let deviceType: DeviceType = "desktop";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(lower)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(lower)) {
    deviceType = "mobile";
  }

  let vendor = "Unknown";
  if (/iphone|ipad|ipod|macintosh|mac os x/i.test(lower)) {
    vendor = "Apple";
  } else if (/samsung|sm-[a-z0-9]+|gt-[a-z0-9]+|samsungbrowser/i.test(lower)) {
    vendor = "Samsung";
  } else if (/xiaomi|redmi|poco|mi \d|miui/i.test(lower)) {
    vendor = "Xiaomi";
  } else if (/huawei|honor|harmonyos/i.test(lower)) {
    vendor = "Huawei";
  } else if (/pixel/i.test(lower)) {
    vendor = "Google Pixel";
  } else if (/oneplus/i.test(lower)) {
    vendor = "OnePlus";
  } else if (/motorola|moto /i.test(lower)) {
    vendor = "Motorola";
  } else if (/sony|xperia/i.test(lower)) {
    vendor = "Sony";
  } else if (/windows/i.test(lower)) {
    vendor = "Windows PC";
  } else if (/linux/i.test(lower) && deviceType === "desktop") {
    vendor = "Linux PC";
  } else if (/android/i.test(lower)) {
    vendor = "Android Device";
  }

  return {
    deviceType,
    vendor,
    screenBucket: bucketScreenWidth(screenWidth),
  };
}

export interface TrafficSourceInfo {
  referrerHost: string;
  channel: TrafficChannel;
  searchEngine: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

const SEARCH_ENGINE_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Google", pattern: /(^|\.)google\.[a-z.]+$/i },
  { name: "Bing", pattern: /(^|\.)bing\.com$/i },
  { name: "DuckDuckGo", pattern: /(^|\.)duckduckgo\.com$/i },
  { name: "Yandex", pattern: /(^|\.)yandex\.[a-z.]+$|(^|\.)ya\.ru$/i },
  { name: "Yahoo", pattern: /(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/i },
  { name: "Baidu", pattern: /(^|\.)baidu\.com$/i },
  { name: "Brave Search", pattern: /(^|\.)search\.brave\.com$/i },
  { name: "Ecosia", pattern: /(^|\.)ecosia\.org$/i },
  { name: "Startpage", pattern: /(^|\.)startpage\.com$/i },
  { name: "Qwant", pattern: /(^|\.)qwant\.com$/i },
  { name: "Naver", pattern: /(^|\.)naver\.com$/i },
  { name: "Google Scholar", pattern: /(^|\.)scholar\.google\.[a-z.]+$/i },
];

const AI_SEARCH_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "ChatGPT", pattern: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i },
  { name: "Perplexity", pattern: /(^|\.)perplexity\.ai$/i },
  { name: "Claude", pattern: /(^|\.)claude\.ai$/i },
  { name: "Gemini", pattern: /(^|\.)gemini\.google\.com$/i },
  { name: "Copilot", pattern: /(^|\.)copilot\.microsoft\.com$/i },
];

const SOCIAL_HOST_RULES: RegExp[] = [
  /(^|\.)t\.me$|(^|\.)telegram\.org$|(^|\.)web\.telegram\.org$/i,
  /(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)t\.co$/i,
  /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/i,
  /(^|\.)instagram\.com$|(^|\.)l\.instagram\.com$/i,
  /(^|\.)reddit\.com$|(^|\.)old\.reddit\.com$/i,
  /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i,
  /(^|\.)facebook\.com$|(^|\.)m\.facebook\.com$|(^|\.)fb\.com$/i,
  /(^|\.)github\.com$/i,
  /(^|\.)virgool\.io$/i,
  /(^|\.)news\.ycombinator\.com$/i,
  /(^|\.)threads\.net$/i,
  /(^|\.)bsky\.app$/i,
  /(^|\.)mastodon\.social$/i,
];

function cleanUtm(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim().toLowerCase().replace(/[^a-z0-9._\-+/ ]/g, "").slice(0, 80);
  return trimmed || null;
}

/**
 * Classifies referrer & UTM parameters into exact Acquisition Channel and Search Engine.
 * Scholar/Gemini are checked before general Google so specialized engines are attributed accurately.
 */
export function classifyTrafficSource(input: {
  referrer?: string | null;
  siteHost?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): TrafficSourceInfo {
  const referrerHost = parseReferrerHost(input.referrer, input.siteHost);
  const utmSource = cleanUtm(input.utmSource);
  const utmMedium = cleanUtm(input.utmMedium);
  const utmCampaign = cleanUtm(input.utmCampaign);

  // Check AI answer engines first (e.g., gemini.google.com before google.*)
  if (referrerHost !== "Direct") {
    for (const rule of AI_SEARCH_RULES) {
      if (rule.pattern.test(referrerHost)) {
        return {
          referrerHost,
          channel: "ai_search",
          searchEngine: rule.name,
          utmSource,
          utmMedium,
          utmCampaign,
        };
      }
    }

    // Check Google Scholar before general Google
    if (/(^|\.)scholar\.google\.[a-z.]+$/i.test(referrerHost)) {
      return {
        referrerHost,
        channel: "search",
        searchEngine: "Google Scholar",
        utmSource,
        utmMedium,
        utmCampaign,
      };
    }

    for (const rule of SEARCH_ENGINE_RULES) {
      if (rule.pattern.test(referrerHost)) {
        return {
          referrerHost,
          channel: "search",
          searchEngine: rule.name,
          utmSource,
          utmMedium,
          utmCampaign,
        };
      }
    }

    if (SOCIAL_HOST_RULES.some((rx) => rx.test(referrerHost))) {
      return {
        referrerHost,
        channel: "social",
        searchEngine: null,
        utmSource,
        utmMedium,
        utmCampaign,
      };
    }
  }

  // Fallback to UTM parameters when present
  if (utmSource || utmMedium || utmCampaign) {
    const srcLower = utmSource || "";
    const medLower = utmMedium || "";
    if (medLower === "organic" || srcLower === "google" || srcLower === "bing" || srcLower === "yandex") {
      const engine =
        srcLower === "google"
          ? "Google"
          : srcLower === "bing"
            ? "Bing"
            : srcLower === "yandex"
              ? "Yandex"
              : srcLower === "duckduckgo"
                ? "DuckDuckGo"
                : null;
      return {
        referrerHost: referrerHost === "Direct" && utmSource ? utmSource : referrerHost,
        channel: engine ? "search" : "campaign",
        searchEngine: engine,
        utmSource,
        utmMedium,
        utmCampaign,
      };
    }
    if (["social", "telegram", "twitter", "x", "linkedin", "instagram"].includes(medLower) ||
        ["telegram", "twitter", "x", "linkedin", "instagram"].includes(srcLower)) {
      return {
        referrerHost: referrerHost === "Direct" && utmSource ? utmSource : referrerHost,
        channel: "social",
        searchEngine: null,
        utmSource,
        utmMedium,
        utmCampaign,
      };
    }
    return {
      referrerHost: referrerHost === "Direct" && utmSource ? utmSource : referrerHost,
      channel: "campaign",
      searchEngine: null,
      utmSource,
      utmMedium,
      utmCampaign,
    };
  }

  if (referrerHost !== "Direct") {
    return {
      referrerHost,
      channel: "referral",
      searchEngine: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    };
  }

  return {
    referrerHost: "Direct",
    channel: "direct",
    searchEngine: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
  };
}

export function normalizeBrowserLanguage(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  const first = raw.split(",")[0]?.split(";")[0]?.trim();
  if (!first) return "Unknown";
  const clean = first.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12);
  return clean || "Unknown";
}

/**
 * Generates a daily-rotating privacy-safe visitor hash (no raw IP stored).
 */
export function buildPrivacyVisitorHash(
  ip: string,
  userAgent: string,
  dayUtc: string,
  secret: string
): string {
  return createHash("sha256")
    .update(`${secret}|${dayUtc}|${ip}|${userAgent.slice(0, 180)}`)
    .digest("hex")
    .slice(0, 24);
}

export interface StoredPageviewRow {
  id?: string;
  article_id: string | null;
  locale: string;
  path: string;
  referrer_host: string;
  device_type: string;
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  region_name?: string | null;
  timezone?: string | null;
  traffic_channel?: string | null;
  search_engine?: string | null;
  browser_name?: string | null;
  browser_version?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  device_vendor?: string | null;
  screen_bucket?: string | null;
  browser_lang?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  visitor_hash?: string | null;
  is_bot?: number | boolean | null;
  created_at: string;
}

export interface RankedDimensionItem {
  key: string;
  label: string;
  labelFa?: string;
  sublabel?: string;
  pageviews: number;
  visitors: number;
  share: number;
}

export interface CountryIntelligenceItem {
  code: string;
  nameEn: string;
  nameFa: string;
  region: RegionCode;
  lon: number;
  lat: number;
  pageviews: number;
  visitors: number;
  share: number;
  topChannel: TrafficChannel;
  topCity: string | null;
}

export interface HourlyBucket {
  hour: number; // 0..23 UTC
  label: string; // "00:00"
  pageviews: number;
  visitors: number;
}

export interface RecentVisitorHit {
  path: string;
  locale: string;
  countryCode: string;
  countryNameEn: string;
  countryNameFa: string;
  city: string | null;
  channel: TrafficChannel;
  searchEngine: string | null;
  referrerHost: string;
  browser: string;
  os: string;
  deviceType: DeviceType;
  createdAt: string;
}

export interface VisitorIntelligenceSummary {
  totalPageviews: number;
  uniqueVisitors: number;
  viewsPerVisitor: number;
  singlePageRatePct: number;
  botHitsExcluded: number;
  countriesCount: number;
  organicSearchSharePct: number;
  aiSearchSharePct: number;
  mobileSharePct: number;
  countries: CountryIntelligenceItem[];
  regions: Array<{ code: RegionCode; pageviews: number; visitors: number; share: number }>;
  channels: RankedDimensionItem[];
  searchEngines: RankedDimensionItem[];
  referrers: RankedDimensionItem[];
  utmCampaigns: Array<{
    source: string;
    medium: string;
    campaign: string;
    pageviews: number;
    visitors: number;
    share: number;
  }>;
  browsers: RankedDimensionItem[];
  browserVersions: RankedDimensionItem[];
  operatingSystems: RankedDimensionItem[];
  osVersions: RankedDimensionItem[];
  devices: RankedDimensionItem[];
  deviceVendors: RankedDimensionItem[];
  screenBuckets: RankedDimensionItem[];
  languages: RankedDimensionItem[];
  topPages: Array<{ path: string; locale: string; pageviews: number; visitors: number; share: number }>;
  hourlyDistribution: HourlyBucket[];
  recentHits: RecentVisitorHit[];
}

export interface VisitorFilterCriteria {
  country?: string | null;
  channel?: string | null;
  searchEngine?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
}

function rowChannel(row: StoredPageviewRow): TrafficChannel {
  const c = row.traffic_channel;
  if (
    c === "search" ||
    c === "ai_search" ||
    c === "social" ||
    c === "campaign" ||
    c === "referral" ||
    c === "direct"
  ) {
    return c;
  }
  // Backward compatibility for legacy rows recorded before traffic_channel existed
  return classifyTrafficSource({
    referrer: row.referrer_host && row.referrer_host !== "Direct" ? `https://${row.referrer_host}` : "",
  }).channel;
}

function rowSearchEngine(row: StoredPageviewRow): string | null {
  if (row.search_engine) return row.search_engine;
  if (!row.referrer_host || row.referrer_host === "Direct") return null;
  return classifyTrafficSource({ referrer: `https://${row.referrer_host}` }).searchEngine;
}

function rowCountryCode(row: StoredPageviewRow): string {
  const raw = (row.country_code || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw) && raw !== "XX") return raw;
  return "ZZ";
}

function extractHourUtc(createdAt: string): number {
  const m = /[T ](\d{2}):/.exec(createdAt);
  if (m) {
    const h = Number(m[1]);
    if (h >= 0 && h <= 23) return h;
  }
  const d = new Date(createdAt.includes("T") ? createdAt : `${createdAt.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? 0 : d.getUTCHours();
}

export function filterPageviewRows(
  rows: StoredPageviewRow[],
  filters?: VisitorFilterCriteria
): StoredPageviewRow[] {
  if (!filters) return rows;
  const fCountry = filters.country?.trim().toUpperCase() || null;
  const fChannel = filters.channel?.trim().toLowerCase() || null;
  const fEngine = filters.searchEngine?.trim().toLowerCase() || null;
  const fBrowser = filters.browser?.trim().toLowerCase() || null;
  const fOs = filters.os?.trim().toLowerCase() || null;
  const fDevice = filters.device?.trim().toLowerCase() || null;

  return rows.filter((row) => {
    if (fCountry && rowCountryCode(row) !== fCountry) return false;
    if (fChannel && rowChannel(row) !== fChannel) return false;
    if (fEngine && (rowSearchEngine(row) || "").toLowerCase() !== fEngine) return false;
    if (fBrowser && (row.browser_name || "Unknown").toLowerCase() !== fBrowser) return false;
    if (fOs && (row.os_name || "Unknown").toLowerCase() !== fOs) return false;
    if (fDevice && (row.device_type || "desktop").toLowerCase() !== fDevice) return false;
    return true;
  });
}

function rankDimension(
  bucketMap: Map<string, { label: string; labelFa?: string; sublabel?: string; pv: number; visitors: Set<string> }>,
  totalPageviews: number,
  limit = 12
): RankedDimensionItem[] {
  return [...bucketMap.entries()]
    .map(([key, b]) => ({
      key,
      label: b.label,
      ...(b.labelFa ? { labelFa: b.labelFa } : {}),
      ...(b.sublabel ? { sublabel: b.sublabel } : {}),
      pageviews: b.pv,
      visitors: b.visitors.size,
      share: totalPageviews > 0 ? Math.round((b.pv / totalPageviews) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pageviews - a.pageviews || b.visitors - a.visitors)
    .slice(0, limit);
}

const CHANNEL_LABELS: Record<TrafficChannel, { en: string; fa: string }> = {
  search: { en: "Organic Search", fa: "موتورهای جستجو" },
  ai_search: { en: "AI Answer Engines", fa: "موتورهای هوش مصنوعی" },
  direct: { en: "Direct", fa: "ورودی مستقیم" },
  social: { en: "Social & Communities", fa: "شبکه‌های اجتماعی" },
  referral: { en: "External Referrals", fa: "سایت‌های ارجاع‌دهنده" },
  campaign: { en: "UTM Campaigns", fa: "کمپین‌های تبلیغاتی (UTM)" },
};

const DEVICE_LABELS: Record<string, { en: string; fa: string }> = {
  desktop: { en: "Desktop", fa: "دسکتاپ" },
  mobile: { en: "Mobile", fa: "موبایل" },
  tablet: { en: "Tablet", fa: "تبلت" },
};

/**
 * Aggregates raw pageview telemetry into rich, multi-dimensional visitor intelligence.
 */
export function aggregateVisitorIntelligence(
  rows: StoredPageviewRow[],
  filters?: VisitorFilterCriteria
): VisitorIntelligenceSummary {
  let botHitsExcluded = 0;
  const humanRows: StoredPageviewRow[] = [];

  for (const r of rows) {
    if (r.is_bot === 1 || r.is_bot === true) {
      botHitsExcluded += 1;
      continue;
    }
    humanRows.push(r);
  }

  const scoped = filterPageviewRows(humanRows, filters);
  const totalPageviews = scoped.length;

  const visitorCounts = new Map<string, number>();
  const countryBuckets = new Map<
    string,
    { pv: number; visitors: Set<string>; channels: Map<TrafficChannel, number>; cities: Map<string, number> }
  >();
  const regionBuckets = new Map<RegionCode, { pv: number; visitors: Set<string> }>();
  const channelBuckets = new Map<string, { label: string; labelFa?: string; pv: number; visitors: Set<string> }>();
  const searchEngineBuckets = new Map<string, { label: string; sublabel?: string; pv: number; visitors: Set<string> }>();
  const referrerBuckets = new Map<string, { label: string; pv: number; visitors: Set<string> }>();
  const utmBuckets = new Map<
    string,
    { source: string; medium: string; campaign: string; pv: number; visitors: Set<string> }
  >();
  const browserBuckets = new Map<string, { label: string; pv: number; visitors: Set<string> }>();
  const browserVersionBuckets = new Map<string, { label: string; sublabel?: string; pv: number; visitors: Set<string> }>();
  const osBuckets = new Map<string, { label: string; pv: number; visitors: Set<string> }>();
  const osVersionBuckets = new Map<string, { label: string; sublabel?: string; pv: number; visitors: Set<string> }>();
  const deviceBuckets = new Map<string, { label: string; labelFa?: string; pv: number; visitors: Set<string> }>();
  const vendorBuckets = new Map<string, { label: string; pv: number; visitors: Set<string> }>();
  const screenBuckets = new Map<string, { label: string; pv: number; visitors: Set<string> }>();
  const langBuckets = new Map<string, { label: string; pv: number; visitors: Set<string> }>();
  const pageBuckets = new Map<string, { path: string; locale: string; pv: number; visitors: Set<string> }>();

  const hourly: Array<{ pv: number; visitors: Set<string> }> = Array.from({ length: 24 }, () => ({
    pv: 0,
    visitors: new Set<string>(),
  }));

  let organicSearchCount = 0;
  let aiSearchCount = 0;
  let mobileCount = 0;

  const touch = (
    map: Map<string, { label: string; labelFa?: string; sublabel?: string; pv: number; visitors: Set<string> }>,
    key: string,
    label: string,
    visitorId: string,
    extra?: { labelFa?: string; sublabel?: string }
  ) => {
    let entry = map.get(key);
    if (!entry) {
      entry = { label, labelFa: extra?.labelFa, sublabel: extra?.sublabel, pv: 0, visitors: new Set() };
      map.set(key, entry);
    }
    entry.pv += 1;
    entry.visitors.add(visitorId);
  };

  for (let i = 0; i < scoped.length; i++) {
    const row = scoped[i];
    const vid = row.visitor_hash || `anon-${row.id || i}`;
    visitorCounts.set(vid, (visitorCounts.get(vid) ?? 0) + 1);

    // Country & Region
    const cCode = rowCountryCode(row);
    const meta = getCountryMeta(cCode);
    const channel = rowChannel(row);
    const engine = rowSearchEngine(row);

    let cBucket = countryBuckets.get(meta.code);
    if (!cBucket) {
      cBucket = { pv: 0, visitors: new Set(), channels: new Map(), cities: new Map() };
      countryBuckets.set(meta.code, cBucket);
    }
    cBucket.pv += 1;
    cBucket.visitors.add(vid);
    cBucket.channels.set(channel, (cBucket.channels.get(channel) ?? 0) + 1);
    if (row.city) {
      cBucket.cities.set(row.city, (cBucket.cities.get(row.city) ?? 0) + 1);
    }

    let rBucket = regionBuckets.get(meta.region);
    if (!rBucket) {
      rBucket = { pv: 0, visitors: new Set() };
      regionBuckets.set(meta.region, rBucket);
    }
    rBucket.pv += 1;
    rBucket.visitors.add(vid);

    // Channels & Search Engines
    if (channel === "search") organicSearchCount += 1;
    if (channel === "ai_search") aiSearchCount += 1;
    touch(channelBuckets, channel, CHANNEL_LABELS[channel].en, vid, {
      labelFa: CHANNEL_LABELS[channel].fa,
    });

    if (engine) {
      touch(searchEngineBuckets, engine, engine, vid, {
        sublabel: channel === "ai_search" ? "AI" : "Search",
      });
    }

    const refHost = row.referrer_host || "Direct";
    touch(referrerBuckets, refHost, refHost, vid);

    if (row.utm_source || row.utm_medium || row.utm_campaign) {
      const src = row.utm_source || "(none)";
      const med = row.utm_medium || "(none)";
      const cmp = row.utm_campaign || "(none)";
      const utmKey = `${src}|${med}|${cmp}`;
      let ub = utmBuckets.get(utmKey);
      if (!ub) {
        ub = { source: src, medium: med, campaign: cmp, pv: 0, visitors: new Set() };
        utmBuckets.set(utmKey, ub);
      }
      ub.pv += 1;
      ub.visitors.add(vid);
    }

    // Browser & Version
    const bName = row.browser_name || "Unknown";
    const bVer = row.browser_version ? `${bName} ${row.browser_version}` : bName;
    touch(browserBuckets, bName, bName, vid);
    touch(browserVersionBuckets, bVer, bVer, vid, { sublabel: bName });

    // OS & Version
    const oName = row.os_name || "Unknown";
    const oVer = row.os_version ? `${oName} ${row.os_version}` : oName;
    touch(osBuckets, oName, oName, vid);
    touch(osVersionBuckets, oVer, oVer, vid, { sublabel: oName });

    // Device Type, Vendor & Screen
    const dType = (row.device_type === "mobile" || row.device_type === "tablet"
      ? row.device_type
      : "desktop") as DeviceType;
    if (dType === "mobile") mobileCount += 1;
    touch(deviceBuckets, dType, DEVICE_LABELS[dType].en, vid, {
      labelFa: DEVICE_LABELS[dType].fa,
    });

    const vendor = row.device_vendor || "Unknown";
    touch(vendorBuckets, vendor, vendor, vid);

    const screen = row.screen_bucket || "Unknown";
    touch(screenBuckets, screen, screen, vid);

    const lang = row.browser_lang || row.locale || "Unknown";
    touch(langBuckets, lang, lang, vid);

    // Pages
    const pathKey = row.path || "/";
    let pBucket = pageBuckets.get(pathKey);
    if (!pBucket) {
      pBucket = { path: pathKey, locale: row.locale || "fa", pv: 0, visitors: new Set() };
      pageBuckets.set(pathKey, pBucket);
    }
    pBucket.pv += 1;
    pBucket.visitors.add(vid);

    // Hourly rhythm
    const hr = extractHourUtc(row.created_at);
    hourly[hr].pv += 1;
    hourly[hr].visitors.add(vid);
  }

  const uniqueVisitors = visitorCounts.size;
  let singlePageVisitors = 0;
  for (const count of visitorCounts.values()) {
    if (count === 1) singlePageVisitors += 1;
  }

  const countries: CountryIntelligenceItem[] = [...countryBuckets.entries()]
    .map(([code, b]) => {
      const meta = getCountryMeta(code);
      let topChannel: TrafficChannel = "direct";
      let topChannelCount = -1;
      for (const [ch, cnt] of b.channels.entries()) {
        if (cnt > topChannelCount) {
          topChannel = ch;
          topChannelCount = cnt;
        }
      }
      let topCity: string | null = null;
      let topCityCount = 0;
      for (const [city, cnt] of b.cities.entries()) {
        if (cnt > topCityCount) {
          topCity = city;
          topCityCount = cnt;
        }
      }
      return {
        code: meta.code,
        nameEn: meta.nameEn,
        nameFa: meta.nameFa,
        region: meta.region,
        lon: meta.lon,
        lat: meta.lat,
        pageviews: b.pv,
        visitors: b.visitors.size,
        share: totalPageviews > 0 ? Math.round((b.pv / totalPageviews) * 1000) / 10 : 0,
        topChannel,
        topCity,
      };
    })
    .sort((a, b) => b.pageviews - a.pageviews || b.visitors - a.visitors);

  const regions = [...regionBuckets.entries()]
    .map(([code, b]) => ({
      code,
      pageviews: b.pv,
      visitors: b.visitors.size,
      share: totalPageviews > 0 ? Math.round((b.pv / totalPageviews) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pageviews - a.pageviews);

  const utmCampaigns = [...utmBuckets.values()]
    .map((u) => ({
      source: u.source,
      medium: u.medium,
      campaign: u.campaign,
      pageviews: u.pv,
      visitors: u.visitors.size,
      share: totalPageviews > 0 ? Math.round((u.pv / totalPageviews) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 12);

  const topPages = [...pageBuckets.values()]
    .map((p) => ({
      path: p.path,
      locale: p.locale,
      pageviews: p.pv,
      visitors: p.visitors.size,
      share: totalPageviews > 0 ? Math.round((p.pv / totalPageviews) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 15);

  const hourlyDistribution: HourlyBucket[] = hourly.map((h, idx) => ({
    hour: idx,
    label: `${String(idx).padStart(2, "0")}:00`,
    pageviews: h.pv,
    visitors: h.visitors.size,
  }));

  const recentHits: RecentVisitorHit[] = scoped.slice(0, 25).map((row) => {
    const meta = getCountryMeta(rowCountryCode(row));
    const bName = row.browser_name || "Unknown";
    const oName = row.os_name || "Unknown";
    return {
      path: row.path || "/",
      locale: row.locale || "fa",
      countryCode: meta.code,
      countryNameEn: meta.nameEn,
      countryNameFa: meta.nameFa,
      city: row.city || null,
      channel: rowChannel(row),
      searchEngine: rowSearchEngine(row),
      referrerHost: row.referrer_host || "Direct",
      browser: row.browser_version ? `${bName} ${row.browser_version}` : bName,
      os: row.os_version ? `${oName} ${row.os_version}` : oName,
      deviceType: (row.device_type === "mobile" || row.device_type === "tablet"
        ? row.device_type
        : "desktop") as DeviceType,
      createdAt: row.created_at,
    };
  });

  return {
    totalPageviews,
    uniqueVisitors,
    viewsPerVisitor: uniqueVisitors > 0 ? Math.round((totalPageviews / uniqueVisitors) * 100) / 100 : 0,
    singlePageRatePct:
      uniqueVisitors > 0 ? Math.round((singlePageVisitors / uniqueVisitors) * 100) : 0,
    botHitsExcluded,
    countriesCount: countries.filter((c) => c.code !== "ZZ").length,
    organicSearchSharePct:
      totalPageviews > 0 ? Math.round((organicSearchCount / totalPageviews) * 1000) / 10 : 0,
    aiSearchSharePct:
      totalPageviews > 0 ? Math.round((aiSearchCount / totalPageviews) * 1000) / 10 : 0,
    mobileSharePct:
      totalPageviews > 0 ? Math.round((mobileCount / totalPageviews) * 1000) / 10 : 0,
    countries,
    regions,
    channels: rankDimension(channelBuckets, totalPageviews, 8),
    searchEngines: rankDimension(searchEngineBuckets, totalPageviews, 12),
    referrers: rankDimension(referrerBuckets, totalPageviews, 12),
    utmCampaigns,
    browsers: rankDimension(browserBuckets, totalPageviews, 10),
    browserVersions: rankDimension(browserVersionBuckets, totalPageviews, 12),
    operatingSystems: rankDimension(osBuckets, totalPageviews, 10),
    osVersions: rankDimension(osVersionBuckets, totalPageviews, 12),
    devices: rankDimension(deviceBuckets, totalPageviews, 4),
    deviceVendors: rankDimension(vendorBuckets, totalPageviews, 10),
    screenBuckets: rankDimension(screenBuckets, totalPageviews, 6),
    languages: rankDimension(langBuckets, totalPageviews, 10),
    topPages,
    hourlyDistribution,
    recentHits,
  };
}
