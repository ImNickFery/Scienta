import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security";

const isProd = process.env.NODE_ENV === "production";
const securityHeaders = buildSecurityHeaders(isProd, {
  previewFrameAncestors: process.env.CSP_HEADER_VALUE,
});

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, private, max-age=0" },
  { key: "Pragma", value: "no-cache" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/admin/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/api/admin/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
