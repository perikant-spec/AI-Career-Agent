// Fail-fast boot-time validation — a missing required var should surface immediately as a clear
// error at startup, not as a cryptic downstream failure (an undefined AUTH_SECRET, for instance,
// would otherwise silently break every session with no obvious cause). Optional integrations
// (ANTHROPIC_API_KEY, ADZUNA_*, STRIPE_*) are deliberately excluded — this app runs correctly
// without any of them, per their own "not configured" honest-degradation patterns.
const REQUIRED_VARS = ["DATABASE_URL", "AUTH_SECRET"] as const;

export type AppEnv = "development" | "staging" | "production";

/**
 * NODE_ENV is Next.js's own build-mode switch — it only ever takes "development"/"production"
 * (Next sets it, code doesn't), and a staging deployment is still a NODE_ENV=production build
 * (same optimizations, same security headers — see next.config.ts's isProd). APP_ENV is the
 * orthogonal, deployment-target concept this app needs on top of that: same build, three
 * different real-world destinations with different safety requirements. Set APP_ENV explicitly
 * in each environment's hosting config (never hardcoded, never inferred from a file that could
 * ship to the wrong place); this only falls back to inferring from NODE_ENV so local
 * `next dev`/`next build` keep working with zero required setup.
 */
export function getAppEnv(): AppEnv {
  const raw = process.env.APP_ENV;
  if (raw === "development" || raw === "staging" || raw === "production") return raw;
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

const LOCAL_HOST_PATTERN = /(localhost|127\.0\.0\.1)/i;

/**
 * The technical enforcement behind "never allow dev config to be used accidentally in
 * production": every check here is something that is fine (even correct) in development but
 * would be a real incident in production — a local database, disk storage that doesn't survive a
 * redeploy, a disabled rate limiter, or a session secret nobody actually generated for this
 * environment. Runs only when APP_ENV resolves to "production" (see getAppEnv) — staging
 * deliberately isn't held to the same bar here, since a staging DB pointing at a non-localhost
 * but still lower-tier instance, or staging intentionally omitting a paid integration, are both
 * legitimate. Throwing (not warning) is the point: a misconfigured production boot should fail
 * loudly at startup, not silently serve traffic against dev infrastructure.
 */
function assertProductionSafety(): void {
  const problems: string[] = [];

  if (process.env.RATE_LIMIT_DISABLED === "true") {
    problems.push("RATE_LIMIT_DISABLED is set — this must never be true in production.");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (LOCAL_HOST_PATTERN.test(databaseUrl)) {
    problems.push("DATABASE_URL points at localhost/127.0.0.1 — production must use a real managed database.");
  }

  if (!process.env.S3_BUCKET) {
    problems.push("S3_BUCKET is not set — production must use object storage, not the local-disk fallback (lib/storage/localDisk.ts is dev-only and doesn't survive a redeploy).");
  }

  const authSecret = process.env.AUTH_SECRET ?? "";
  if (authSecret.length < 32) {
    problems.push("AUTH_SECRET is missing or too short for production — generate a real one with `npx auth secret`.");
  }

  const authUrl = process.env.AUTH_URL ?? "";
  if (LOCAL_HOST_PATTERN.test(authUrl)) {
    problems.push("AUTH_URL points at localhost — production must use the real deployed origin.");
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to boot with APP_ENV=production against unsafe configuration:\n- ${problems.join("\n- ")}`
    );
  }
}

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Copy .env.example to .env and fill them in (AUTH_SECRET: run \`npx auth secret\`).`
    );
  }

  if (getAppEnv() === "production") {
    assertProductionSafety();
  }
}
