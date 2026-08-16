import type { NextAuthConfig } from "next-auth";

// Minimal half of the Auth.js config, kept free of the Prisma import that auth.ts needs for
// `authorize()` — originally required because proxy.ts (formerly middleware.ts) ran on the Edge
// runtime, where Prisma Client can't run. As of Next.js 16, proxy.ts always runs on Node.js (the
// `edge` runtime is no longer supported there), but this file still exists to keep that entry
// point's module graph minimal: it only needs the route-protection callback below, not a
// DB-backed session provider.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    // Credentials provider requires JWT sessions — database sessions need an adapter, which
    // is incompatible with Credentials.
    strategy: "jwt",
  },
  providers: [], // populated in auth.ts
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = [
        "/assistant",
        "/resumes",
        "/profile",
        "/jobs",
        "/applications",
        "/analytics",
        "/settings",
      ];
      const isProtectedRoute = protectedPrefixes.some((p) =>
        request.nextUrl.pathname.startsWith(p)
      );

      if (isProtectedRoute) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
