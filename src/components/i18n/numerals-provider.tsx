"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_NUMERALS,
  NUMERALS_COOKIE,
  NUMERALS_COOKIE_MAX_AGE,
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

/**
 * Carries the reader's numeral preference to client components, and owns the
 * act of changing it.
 *
 * Switching does three things at once, deliberately:
 *  - flips `data-numerals` on <html>, which retypes every ASCII digit already
 *    on screen through the font-feature rule in globals.css (article bodies
 *    included — those digits never passed through Intl);
 *  - writes the cookie so the server renders the same choice next request,
 *    with no flash of the other numeral system;
 *  - refreshes the route so Server Components re-run Intl and pick up the
 *    matching group separator (٬ against ,).
 */
export function NumeralsProvider({
  initial,
  children,
}: {
  initial: Numerals;
  children: React.ReactNode;
}) {
  const [numerals, setState] = useState<Numerals>(initial);

  const setNumerals = useCallback((next: Numerals) => {
    setState(next);
    document.documentElement.dataset.numerals = next;
    document.cookie = `${NUMERALS_COOKIE}=${next}; path=/; max-age=${NUMERALS_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ numerals, setNumerals }), [numerals, setNumerals]);

  return <NumeralsContext.Provider value={value}>{children}</NumeralsContext.Provider>;
}
