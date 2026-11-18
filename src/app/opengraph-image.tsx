import { ImageResponse } from "next/og";

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
          background: "#05050A",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(123,63,251,0.45) 0%, rgba(5,5,10,0) 55%), " +
            "radial-gradient(circle at 85% 25%, rgba(255,122,0,0.32) 0%, rgba(5,5,10,0) 55%), " +
            "radial-gradient(circle at 50% 100%, rgba(255,60,90,0.28) 0%, rgba(5,5,10,0) 55%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 110,
            height: 110,
            borderRadius: 26,
            background: "linear-gradient(135deg, #7B3FFB 0%, #FF3C5A 100%)",
            marginBottom: 36,
          }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
            <path
              d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
              fill="white"
            />
          </svg>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: -2,
            backgroundImage: "linear-gradient(110deg, #7B3FFB 0%, #FF7A00 55%, #FF3C5A 100%)",
            backgroundClip: "text",
            color: "transparent",
            fontFamily: "sans-serif",
          }}
        >
          Scienta
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 30,
            color: "#a8a8bd",
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
