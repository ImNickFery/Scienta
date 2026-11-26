import { ImageResponse } from "next/og";
import { SCIENTA_LOGO_PATHS } from "@/lib/brand-logo-geometry";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#06060B",
          backgroundImage:
            "radial-gradient(circle at 50% 35%, rgba(123,63,251,0.2) 0%, rgba(6,6,11,0) 58%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 5,
          }}
        >
          <svg width="70" height="84" viewBox="12 8 40 48" fill="none" style={{ marginBottom: 11 }}>
            <defs>
              <linearGradient id="og-u" x1="15%" y1="10%" x2="85%" y2="70%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#D8D8E4" />
              </linearGradient>
              <linearGradient id="og-l" x1="85%" y1="90%" x2="20%" y2="35%">
                <stop offset="0%" stopColor="#B89BFF" />
                <stop offset="100%" stopColor="#7B3FFB" />
              </linearGradient>
            </defs>
            <path d={SCIENTA_LOGO_PATHS.prismUpper} fill="url(#og-u)" />
            <path d={SCIENTA_LOGO_PATHS.prismLower} fill="url(#og-l)" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 700,
              lineHeight: 0.82,
              letterSpacing: -3.5,
              color: "#F5F5FA",
              fontFamily: "sans-serif",
            }}
          >
            cienta
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 28,
            color: "#9494AA",
            fontFamily: "sans-serif",
          }}
        >
          An immersive scientific publication
        </div>
      </div>
    ),
    { ...size }
  );
}
