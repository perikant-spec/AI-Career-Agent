import type { NextAuthConfig } from "next-auth";

// Edge-safe half of the Auth.js config — no Prisma import here (Prisma Client cannot run in
// the Edge runtime middleware uses). The Credentials provider's `authorize()` is attached in
// auth.ts (Node runtime) instead; this file only needs the provider's id/name for middleware
// to recognize the sign-in route, plus the route-protection callback.
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
