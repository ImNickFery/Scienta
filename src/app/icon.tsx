import { ImageResponse } from "next/og";
import { SCIENTA_LOGO_PATHS, SCIENTA_LOGO_VIEWBOX } from "@/lib/brand-logo-geometry";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: "linear-gradient(135deg, #13131E 0%, #07070C 100%)",
          border: "1px solid rgba(255, 255, 255, 0.16)",
        }}
      >
        <svg width="24" height="24" viewBox={SCIENTA_LOGO_VIEWBOX} fill="none">
          <path d={SCIENTA_LOGO_PATHS.prismUpper} fill="#FFFFFF" />
          <path d={SCIENTA_LOGO_PATHS.prismLower} fill="#9B75FF" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
