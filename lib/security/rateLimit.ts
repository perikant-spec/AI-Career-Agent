// In-memory fixed-window rate limiter — deliberately the simplest thing that actually works for
// a single-instance deployment, same "MVP timer, not a distributed system" pattern used
// elsewhere (Follow-Up Engine, mobile JWT TTL). A multi-instance production deployment would
// need a shared store (Redis/Upstash) instead, since each instance would otherwise keep its own
// independent counters and the effective limit would scale with instance count.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Unbounded growth guard — without this, an attacker cycling through IPs/keys could grow this
// map forever. Sweeps expired buckets whenever the map crosses a threshold rather than on a
// timer, so it costs nothing on the (overwhelmingly common) request that doesn't trigger it.
const SWEEP_THRESHOLD = 10_000;

function sweepExpired(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

// Test/local-dev escape hatch only — lets integration tests register many accounts in a tight
// loop without tripping the same limits a real attacker would hit. Double-gated on NODE_ENV so a
// misconfigured production environment variable can't silently disable rate limiting: even if
// RATE_LIMIT_DISABLED is accidentally set to "true" in production, this stays a no-op there.
function isRateLimitDisabledForTests(): boolean {
  return process.env.RATE_LIMIT_DISABLED === "true" && process.env.NODE_ENV !== "production";
}

export function checkRateLimit(key: string, windowMs: number, max: number): RateLimitResult {
  if (isRateLimitDisabledForTests()) return { allowed: true };

  const now = Date.now();
  sweepExpired(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  existing.count += 1;
  if (existing.count > max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

/** Best-effort client identifier for rate-limit keying — trusts x-forwarded-for since this app
 *  is expected to run behind a reverse proxy/platform load balancer in production; falls back to
 *  a shared bucket if absent (e.g. direct local access), which just means local requests share
 *  one limit rather than being unlimited. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return new Response(JSON.stringify({ error: "Too many attempts. Please try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSeconds) },
  });
}

// Only exported for tests — resets shared module state between test cases.
export function __resetRateLimitStateForTests(): void {
  buckets.clear();
}
