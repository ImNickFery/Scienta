import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales } from "@/lib/i18n/config";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@/lib/auth";

function getLocaleFromHeader(request: NextRequest): string {
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0];
  return locales.includes(preferred as (typeof locales)[number]) ? preferred! : defaultLocale;
}

async function handleAdmin(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const isPublicAdminPath = pathname === "/admin/login";
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (isPublicAdminPath) {
    // Already logged in — skip the login screen.
    if (payload) return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    return null;
  }

  if (!payload) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const result = await handleAdmin(request);
    if (result) return result;
    return NextResponse.next();
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Skip internal/static assets, the API layer (each API route guards
  // itself), and Next's extensionless file-convention metadata routes
  // (favicon/OG/social-card images — these have no "." in their URL and
  // must be served as-is, never redirected under a /fa or /en prefix).
  const METADATA_ROUTES = new Set(["/icon", "/apple-icon", "/opengraph-image", "/twitter-image", "/manifest"]);
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    METADATA_ROUTES.has(pathname)
  ) {
    return NextResponse.next();
  }

  const locale = getLocaleFromHeader(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
