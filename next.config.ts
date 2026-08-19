import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// A strict CSP breaks Next's dev-mode HMR (inline eval-based scripts) and the React DevTools
// bridge, so it's production-only — dev still gets every other header. No external script/style/
// font/image origins are ever loaded (next/font self-hosts Google Fonts at build time; no CDN,
// no third-party embeds), so this can stay tight without an allowlist to maintain.
//
// script-src needs 'unsafe-inline' -- without it, this blocked Next's own inline hydration
// bootstrap scripts in production (confirmed live: CSP violations in the console followed by a
// React hydration error), breaking client-side interactivity across the whole app, not just one
// component. style-src already carried 'unsafe-inline' for the same reason (Next's inline
// styles); script-src missing it was the actual bug, not a deliberate choice -- there's no nonce
// generated anywhere in proxy.ts, and Next.js's own CSP guide is explicit that script-src
// without a nonce must include 'unsafe-inline' or the framework's own scripts get blocked. The
// stricter alternative (a proxy-generated nonce, allowing 'unsafe-inline' to be dropped) is a
// real option later, but it requires forcing every page into dynamic rendering (no more static
// generation/ISR/CDN caching) -- a bigger, separate tradeoff than this fix.
const CSP_PROD =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

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
  // this keeps them as plain Node `require`s instead. @napi-rs/canvas is pdf-parse's own
  // dependency (pdfjs-dist uses it to polyfill DOMMatrix/ImageData/Path2D, which don't exist in
  // Node) -- ships a platform-specific native binary the same way, so it gets the same treatment.
  serverExternalPackages: ["pdf-parse", "mammoth", "@napi-rs/canvas"],

  // @napi-rs/canvas's platform-specific native binary lives in a SEPARATE package
  // (@napi-rs/canvas-linux-x64-gnu on Vercel, resolved by @napi-rs/canvas's own index.js at
  // runtime based on process.platform/arch) -- a dynamic require Vercel's file-tracer
  // (@vercel/nft) can't follow statically, so it silently excluded the binary from the deployed
  // Lambda even with serverExternalPackages set. The glob matches "canvas*", not just "canvas",
  // to also catch that sibling package. Scoped to only the one route that actually calls
  // extractResumeText (app/api/resumes/route.ts) -- an earlier version of this fix used the
  // global "/*" key, which bundled this multi-MB native binary into every route's function and
  // pushed the deployment over Vercel Hobby's 12-serverless-function limit outright.
  outputFileTracingIncludes: {
    "/api/resumes": ["node_modules/@napi-rs/canvas*/**/*"],
  },

  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
