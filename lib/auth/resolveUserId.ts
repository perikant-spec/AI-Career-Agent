import { auth } from "@/auth";
import { verifyMobileToken } from "@/lib/mobile/auth";
import { prisma } from "@/lib/prisma";

/**
 * The single point where "shared backend" is actually true: web authenticates via NextAuth's
 * cookie session, mobile has no cookie jar so it sends `Authorization: Bearer <token>` instead.
 * Every route mobile calls resolves the user through this instead of calling `auth()` directly,
 * so both clients hit the identical business logic and tenant-isolation query shape afterward.
 *
 * Both paths only prove "a token/cookie signed for this userId is cryptographically valid and
 * unexpired" — neither re-checks that the user row still exists. A deleted account's 30-day
 * mobile JWT (or a stale NextAuth session cookie) would otherwise keep resolving to a userId
 * that downstream queries then fail on with a foreign-key error instead of a clean 401. This
 * existence check is the fix, at the cost of one indexed lookup per authenticated request.
 */
export async function resolveUserId(request: Request): Promise<string | null> {
  const userId = await resolveRawUserId(request);
  if (!userId) return null;

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return exists ? userId : null;
}

async function resolveRawUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const payload = await verifyMobileToken(token);
    return payload?.userId ?? null;
  }

  const session = await auth();
  return session?.user?.id ?? null;
}
