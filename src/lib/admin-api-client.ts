"use client";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface AdminApiError {
  error: string;
  details?: unknown;
}

const SKIP_REFRESH_PATHS = new Set([
  "/api/admin/auth/me",
  "/api/admin/auth/login",
  "/api/admin/auth/refresh",
]);

let inFlightRefresh: Promise<boolean> | null = null;

async function refreshSessionOnce(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = fetch("/api/admin/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

export async function adminFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCookie("aurora_csrf");
    if (csrf) headers.set("x-csrf-token", csrf);
    if (!headers.has("content-type") && options.body && !(options.body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }
  }

  const res = await fetch(path, { ...options, headers, credentials: "include" });

  if (res.status === 401 && !SKIP_REFRESH_PATHS.has(path)) {
    // Share a single refresh flight across concurrent 401s so token rotation
    // reuse detection is never falsely tripped.
    const refreshed = await refreshSessionOnce();
    if (refreshed) {
      if (method !== "GET" && method !== "HEAD") {
        const refreshedCsrf = readCookie("aurora_csrf");
        if (refreshedCsrf) headers.set("x-csrf-token", refreshedCsrf);
      }
      const retry = await fetch(path, { ...options, headers, credentials: "include" });
      if (!retry.ok) throw await toError(retry);
      if (retry.status === 204) return undefined as T;
      return retry.json();
    }
    window.location.href = "/admin/login";
    throw new Error("Session expired");
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function toError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => ({ error: res.statusText }))) as AdminApiError;
  return new Error(body.error || "Request failed");
}
