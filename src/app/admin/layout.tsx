import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "../globals.css";
import { AdminAuthProvider } from "@/components/admin/admin-auth-context";
import { AdminLocaleProvider } from "@/components/admin/admin-locale-context";
import { AdminShell } from "@/components/admin/admin-shell";
import { fontVariables } from "@/fonts";
import { SITE_URL } from "@/lib/seo";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05050A",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Scienta Admin", template: "%s — Scienta Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={fontVariables}>
      <body className="min-h-dvh bg-(--color-bg-deep) antialiased">
        <AdminAuthProvider>
          <AdminLocaleProvider>
            <AdminShell>{children}</AdminShell>
          </AdminLocaleProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
