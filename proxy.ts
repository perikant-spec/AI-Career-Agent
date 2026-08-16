import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

// Built from auth.config.ts, not auth.ts, to keep Prisma out of this file — originally required
// because `middleware.ts` ran on the Edge runtime (Prisma can't run there); as of Next.js 16 this
// file (renamed to `proxy.ts`, `edge` no longer supported here) always runs on the Node.js
// runtime, but the split still keeps this entry point minimal and avoids pulling the full auth.ts
// module graph into every request that only needs route-protection, not a DB-backed session.
const { auth: pageAuthMiddleware } = NextAuth(authConfig);

// API routes do their own auth per-request via resolveUserId (cookie session or mobile Bearer
// token) — this middleware's only job for /api/* is CORS, since the Expo *web* target is a real
// browser making cross-origin requests to the Next.js origin (native iOS/Android has no CORS
// concept at all). Restricted to localhost dev origins for now; a hosted Expo web build would
// need its real origin added here.
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  if (origin && LOCALHOST_ORIGIN.test(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// General backstop for every /api/* route, on top of the tighter per-endpoint limits already in
// place at the more sensitive routes (auth, uploads, AI calls, generation). This one is
// deliberately loose — its job is to cap worst-case abuse of *any* endpoint (including ones that
// don't have their own specific limit), not to constrain normal usage.
const GENERAL_API_WINDOW_MS = 5 * 60 * 1000;
const GENERAL_API_MAX = 300;

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const headers = corsHeaders(request.headers.get("origin"));
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers });
    }

    const generalLimit = checkRateLimit(`general-api:${getClientIp(request)}`, GENERAL_API_WINDOW_MS, GENERAL_API_MAX);
    if (!generalLimit.allowed) {
      const limited = rateLimitResponse(generalLimit.retryAfterSeconds!);
      for (const [key, value] of Object.entries(headers)) limited.headers.set(key, value);
      return limited;
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  }

  return (pageAuthMiddleware as unknown as (req: NextRequest) => Promise<NextResponse>)(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
