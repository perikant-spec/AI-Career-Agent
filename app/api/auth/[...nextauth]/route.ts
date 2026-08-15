import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export const { GET } = handlers;

// Only the credentials sign-in submission gets rate-limited here — every other NextAuth POST
// under this catch-all (CSRF token, sign-out, session) is low-risk and shouldn't share a budget
// with login attempts. Keyed by IP only (not IP+email): the request body is form-encoded and
// handlers.POST needs to consume the stream itself, so cloning it just to read `email` isn't
// worth the complexity for a limit that's already generous enough to not bother legitimate users
// sharing a network.
export async function POST(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  if (pathname.endsWith("/callback/credentials")) {
    const rate = checkRateLimit(`nextauth-login:${getClientIp(request)}`, 15 * 60 * 1000, 15);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);
  }
  return handlers.POST(request);
}
