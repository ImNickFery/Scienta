import { randomToken } from "./auth";

export const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return randomToken(32);
}

/** Compares the CSRF cookie value against the header sent by the client (double-submit pattern). */
export function verifyCsrf(cookieValue: string | undefined, headerValue: string | null): boolean {
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;
  // Constant-time-ish comparison to avoid trivial timing leaks.
  let mismatch = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    mismatch |= cookieValue.charCodeAt(i) ^ headerValue.charCodeAt(i);
  }
  return mismatch === 0;
}
