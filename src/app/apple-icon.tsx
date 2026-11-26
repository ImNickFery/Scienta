import { ImageResponse } from "next/og";
import { SCIENTA_LOGO_PATHS, SCIENTA_LOGO_VIEWBOX } from "@/lib/brand-logo-geometry";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #13131E 0%, #07070C 100%)",
        }}
      >
        <svg width="132" height="132" viewBox={SCIENTA_LOGO_VIEWBOX} fill="none">
          <defs>
            <linearGradient id="ap-u" x1="15%" y1="10%" x2="85%" y2="70%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#D8D8E4" />
            </linearGradient>
            <linearGradient id="ap-l" x1="85%" y1="90%" x2="20%" y2="35%">
              <stop offset="0%" stopColor="#B89BFF" />
              <stop offset="100%" stopColor="#7B3FFB" />
            </linearGradient>
          </defs>
          <path d={SCIENTA_LOGO_PATHS.prismUpper} fill="url(#ap-u)" />
          <path d={SCIENTA_LOGO_PATHS.prismLower} fill="url(#ap-l)" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
