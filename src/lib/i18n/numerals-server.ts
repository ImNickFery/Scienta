import { cookies } from "next/headers";
import { cache } from "react";
import { NUMERALS_COOKIE, parseNumerals, type Numerals } from "./numerals";

/**
 * The reader's numeral preference, for Server Components.
 *
 * Kept in its own module because `next/headers` cannot be imported from
 * anything that also runs on the client, and that import is itself the guard —
 * pulling this into a client component is a build error. The shared helpers
 * live in `./numerals`; client components read the same value from
 * `NumeralsProvider` instead.
 *
 * `cache` dedupes the read across every component in one request.
 */
export const getNumerals = cache(async (): Promise<Numerals> => {
  const store = await cookies();
  return parseNumerals(store.get(NUMERALS_COOKIE)?.value);
});
