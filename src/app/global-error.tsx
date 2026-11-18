"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body style={{ background: "#05050A", color: "#f5f5fa", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: "#a8a8bd", maxWidth: "28rem" }}>
            The application hit an unexpected error. Please try again, or return to the homepage.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={reset}
              style={{ background: "linear-gradient(135deg, #7B3FFB, #FF7A00)", color: "white", border: "none", borderRadius: "999px", padding: "0.75rem 1.5rem", cursor: "pointer" }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error
                replaces the entire root layout on a crash, so app router context
                (and therefore next/link) may not be available; a plain anchor
                is the pattern Next.js itself documents for this file. */}
            <a
              href="/fa"
              style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#f5f5fa", borderRadius: "999px", padding: "0.75rem 1.5rem", textDecoration: "none" }}
            >
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
