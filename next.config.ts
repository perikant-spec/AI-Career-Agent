import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// A strict CSP breaks Next's dev-mode HMR (inline eval-based scripts) and the React DevTools
// bridge, so it's production-only — dev still gets every other header. No external script/style/
// font/image origins are ever loaded (next/font self-hosts Google Fonts at build time; no CDN,
// no third-party embeds), so this can stay tight without an allowlist to maintain.
const CSP_PROD =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: CSP_PROD },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (traced node_modules + a server.js
  // entrypoint) instead of requiring the full node_modules tree at runtime — this is what makes
  // the Dockerfile's runtime image small, for Docker/self-hosted deploys (Railway/Render/Fly/a
  // VPS). Vercel's own build pipeline does NOT tolerate this option: it produces its own output
  // via the Build Output API and expects the standard (non-standalone) trace files, so leaving
  // this on unconditionally breaks the Vercel build with "ENOENT .next/next-server.js.nft.json"
  // during Vercel's own onBuildComplete step -- confirmed by a real deployment failure, which
  // disproved an earlier, untested assumption that Vercel simply "ignores" this option.
  // process.env.VERCEL is set to "1" during every Vercel build and runtime.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  // pdf-parse/mammoth are only ever imported from server-only route handlers, but Next's
  // bundler will still try to trace/bundle them for the server runtime unless told not to —
  // this keeps them as plain Node `require`s instead.
  serverExternalPackages: ["pdf-parse", "mammoth"],

  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
