import { getAppEnv } from "@/lib/env";

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

// Test/local-dev/CI escape hatch only — lets integration tests register many accounts in a
// tight loop without tripping the same limits a real attacker would hit. Double-gated on
// getAppEnv() (lib/env.ts), not NODE_ENV, so a misconfigured production environment variable
// can't silently disable rate limiting: even if RATE_LIMIT_DISABLED is accidentally set to
// "true" in production, this stays a no-op there. NODE_ENV alone can't make this distinction —
// `next start` always sets NODE_ENV=production even for a CI job testing that production build
// against local infrastructure (see .github/workflows/ci.yml's integration-tests job, which sets
// APP_ENV=development precisely so this escape hatch still works there); APP_ENV is the actual
// "is this a real production deployment" signal.
function isRateLimitDisabledForTests(): boolean {
  return process.env.RATE_LIMIT_DISABLED === "true" && getAppEnv() !== "production";
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

export interface DualRateLimitConfig {
  /** A short, stable name for the endpoint being limited, e.g. "resume-upload" — becomes part of
   *  the bucket key, so it must be unique per limited action. */
  scope: string;
  userId: string;
  userMax: number;
  userWindowMs: number;
  globalMax: number;
  globalWindowMs: number;
}

/** Per-user limits alone cap what any single account can do, but do nothing against many cheap
 *  accounts each staying just under their own cap — the aggregate cost (AI API spend, DB load)
 *  is the same either way. This checks a shared "global:<scope>" bucket first (protects the
 *  service as a whole) and only then the per-user bucket (protects against one account hammering
 *  its own share) — whichever trips first is reported, so the caller always gets one answer. */
export function checkUserAndGlobalRateLimit(config: DualRateLimitConfig): RateLimitResult {
  const globalResult = checkRateLimit(`global:${config.scope}`, config.globalWindowMs, config.globalMax);
  if (!globalResult.allowed) return globalResult;
  return checkRateLimit(`user:${config.scope}:${config.userId}`, config.userWindowMs, config.userMax);
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
