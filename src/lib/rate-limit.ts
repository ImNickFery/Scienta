interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map doesn't grow unbounded on long-running processes.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

function evictIfNeeded(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
  // If still at capacity (e.g. spoofed-IP flood), evict the oldest entries.
  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

/**
 * Fixed-window rate limiter with bounded memory (DoS-safe). Suitable for a single
 * Node process (cPanel Passenger/Node). For multi-instance deployments, swap for Redis.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    evictIfNeeded(now);
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, retryAfterSeconds };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds,
  };
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-fA-F:]{2,45}$/;

function parseValidIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let candidate = raw.trim();
  if (!candidate || candidate.length > 64) return null;

  // Strip optional IPv6 brackets and :port suffix
  if (candidate.startsWith("[")) {
    const close = candidate.indexOf("]");
    if (close === -1) return null;
    candidate = candidate.slice(1, close);
  } else if (candidate.includes(".") && candidate.includes(":")) {
    // IPv4:port
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  const v4 = IPV4_RE.exec(candidate);
  if (v4) {
    const octets = [Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4])];
    return octets.every((n) => n >= 0 && n <= 255) ? candidate : null;
  }

  if (IPV6_RE.test(candidate) && candidate.includes(":")) {
    return candidate.toLowerCase();
  }

  return null;
}

/** Extracts and validates the client IP strictly from proxy headers. */
export function getClientIp(req: Request): string {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    ...(req.headers.get("x-forwarded-for")?.split(",") ?? []),
  ];

  for (const raw of candidates) {
    const valid = parseValidIp(raw);
    if (valid) return valid;
  }

  return "unknown";
}
