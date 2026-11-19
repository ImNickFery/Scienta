"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, Lock, Mail, Loader2, ArrowLeft } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { sanitizeAdminRedirect } from "@/lib/security";
import { AuroraBackground } from "@/components/animations/aurora-background";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminFetch("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const target = sanitizeAdminRedirect(searchParams.get("from"));
      window.location.assign(target === "/admin" ? "/admin/dashboard" : target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-(--color-bg-deep) px-4">
      <AuroraBackground />
      <div className="glass-panel relative w-full max-w-sm rounded-2xl p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-red)">
            <Sparkles className="h-6 w-6 text-white" />
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-gradient-aurora">
            Scienta Admin
          </h1>
          <p className="mt-1 text-sm text-(--color-text-tertiary)">Sign in to manage your platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 start-4 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
            <input
              type="email"
              required
              autoFocus
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-xl border border-(--color-border-subtle) bg-black/20 ps-11 pe-4 text-sm text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 start-4 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-(--color-border-subtle) bg-black/20 ps-11 pe-4 text-sm text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-3 py-2 text-xs text-(--color-accent-red)">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) text-sm font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In
          </button>
        </form>

        <div className="mt-6 border-t border-(--color-border-subtle) pt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-(--color-text-tertiary) transition-colors hover:text-(--color-text-primary)"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Scienta
          </Link>
        </div>
      </div>
    </div>
  );
}
