# Multi-stage build targeting Next.js's `output: "standalone"` mode (next.config.ts) — the
# runtime image only carries the traced node_modules subset + a server.js entrypoint, not the
# full dependency tree. Base is Debian-slim to match prisma/schema.prisma's
# `debian-openssl-3.0.x` binaryTarget; verified locally by running the standalone build's own
# server.js directly (Docker isn't available in the environment this was authored in) — build
# succeeds, `output: "standalone"` produces the expected .next/standalone/server.js, the Prisma
# client ships the debian-openssl-3.0.x query engine binary, and a real request round-trip
# (register -> 201, static asset -> 200) passes against it. The actual `docker build` /
# `docker run` needs to be verified once in a real Docker environment (CI or your machine)
# before relying on this in staging/production.

FROM node:20-slim AS base

# ---- deps: install once, cached across builds unless package*.json changes ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./

# npm ci's postinstall hook (package.json) runs `prisma generate`, which reads DATABASE_URL at
# config-load time even though it never connects to it -- same build-time-only placeholder the
# builder stage below uses, needed here too now that generation happens during install, not only
# via the builder stage's own explicit `npx prisma generate`.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/placeholder"
RUN npm ci

# ---- builder: generate the Prisma client and produce the standalone Next.js build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time-only placeholders — `next build` needs *some* value for these (validated at runtime
# by lib/env.ts, not at build time), but never touches a real database or serves real traffic
# during the build. Real values are injected at container start, not baked into the image.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/placeholder"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ENV AUTH_URL="http://localhost:3000"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ---- runner: minimal runtime image ----
FROM base AS runner
WORKDIR /app

# Prisma's query engine binary needs libssl at runtime; node:20-slim doesn't include it.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Runs as a non-root user, matching the uid/gid Next.js's own Docker examples use.
RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# APP_ENV/DATABASE_URL/AUTH_SECRET/AUTH_URL/S3_*/etc. are supplied by the platform's environment
# configuration at run time (see .env.staging.example / .env.production.example and
# docs/DEPLOYMENT.md) — never baked into the image. lib/env.ts's assertProductionSafety() refuses
# to boot if APP_ENV=production and any of those are missing or look dev-shaped.
CMD ["node", "server.js"]
