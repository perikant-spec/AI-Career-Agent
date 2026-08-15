// Fail-fast boot-time validation — a missing required var should surface immediately as a clear
// error at startup, not as a cryptic downstream failure (an undefined AUTH_SECRET, for instance,
// would otherwise silently break every session with no obvious cause). Optional integrations
// (ANTHROPIC_API_KEY, ADZUNA_*, STRIPE_*) are deliberately excluded — this app runs correctly
// without any of them, per their own "not configured" honest-degradation patterns.
const REQUIRED_VARS = ["DATABASE_URL", "AUTH_SECRET"] as const;

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Copy .env.example to .env and fill them in (AUTH_SECRET: run \`npx auth secret\`).`
    );
  }
}
