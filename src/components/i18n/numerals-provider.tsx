"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_NUMERALS,
  NUMERALS_COOKIE,
  NUMERALS_COOKIE_MAX_AGE,
  isNumerals,
  type Numerals,
} from "@/lib/i18n/numerals";

type NumeralsContextValue = {
  numerals: Numerals;
  setNumerals: (next: Numerals) => void;
};

const NumeralsContext = createContext<NumeralsContextValue>({
  numerals: DEFAULT_NUMERALS,
  setNumerals: () => {},
});

export function useNumerals() {
  return useContext(NumeralsContext);
}

export function writeClientCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const attrs = isHttps
    ? `; path=/; max-age=${maxAge}; samesite=none; secure`
    : `; path=/; max-age=${maxAge}; samesite=lax`;
  document.cookie = `${name}=${encodeURIComponent(value)}${attrs}`;
}

/**
 * Carries the reader's numeral preference to client components, and owns the
 * act of changing it.
 */
export function NumeralsProvider({
  initial,
  children,
}: {
  initial: Numerals;
  children: React.ReactNode;
}) {
  const [numerals, setState] = useState<Numerals>(initial);

  // If the page is embedded in an iframe where SSR cookies were unavailable,
  // re-apply the reader's stored preference cleanly without overriding explicit SSR cookies.
  useEffect(() => {
    try {
      const hasCookie = document.cookie.split(";").some((c) => c.trim().startsWith(`${NUMERALS_COOKIE}=`));
      if (hasCookie) return;
      const saved = window.localStorage.getItem(NUMERALS_COOKIE);
      if (isNumerals(saved) && saved !== initial) {
        document.documentElement.dataset.numerals = saved;
        writeClientCookie(NUMERALS_COOKIE, saved, NUMERALS_COOKIE_MAX_AGE);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restores client-side preference when third-party cookies were unavailable during SSR
        setState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, [initial]);

  const setNumerals = useCallback((next: Numerals) => {
    setState(next);
    document.documentElement.dataset.numerals = next;
    writeClientCookie(NUMERALS_COOKIE, next, NUMERALS_COOKIE_MAX_AGE);
    try {
      window.localStorage.setItem(NUMERALS_COOKIE, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo(() => ({ numerals, setNumerals }), [numerals, setNumerals]);

  return <NumeralsContext.Provider value={value}>{children}</NumeralsContext.Provider>;
}

