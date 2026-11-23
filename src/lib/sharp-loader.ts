import { createRequire } from "node:module";
import type sharpType from "sharp";

export type SharpFn = typeof sharpType;

let cachedSharp: SharpFn | null | undefined;

function dynamicRequire(req: NodeRequire, specifier: string): unknown {
  return req(specifier);
}

/**
 * Dynamically loads host-native `sharp` without creating a static Turbopack
 * hashed external symlink (`sharp-<hash>`). Returns `null` if native `sharp`
 * is unavailable on the host GLIBC/Node ABI so routes stay up instead of
 * crashing the server with 503.
 */
export function loadSharp(): SharpFn | null {
  if (cachedSharp !== undefined) return cachedSharp;

  const pkgName = ["sh", "arp"].join("");
  const req = createRequire(import.meta.url);

  try {
    const mod = dynamicRequire(req, pkgName) as SharpFn | { default?: SharpFn };
    const fn = typeof mod === "function" ? mod : mod?.default;
    if (typeof fn === "function") {
      try {
        fn.concurrency(1);
        fn.cache({ memory: 24, files: 0, items: 40 });
      } catch {
        // Ignore if sharp build exposes read-only concurrency/cache
      }
      cachedSharp = fn;
      return cachedSharp;
    }
  } catch {
    // Native sharp is optional on shared hosts with older GLIBC/ABI
  }

  cachedSharp = null;
  return null;
}
