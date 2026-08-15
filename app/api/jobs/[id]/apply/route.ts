import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { ensureApplicationPackage } from "@/lib/application/generateApplicationPackage";
import { assertProFeature } from "@/lib/billing/entitlements";
import { checkUserAndGlobalRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimits.config";

/** Idempotent "prepare application" — generates whatever's missing, redirects the UI to the
 *  application id it created/found. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gate = await assertProFeature(userId, "APPLICATION_PACKAGE");
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgradeRequired: true }, { status: 402 });
  }

  const rate = checkUserAndGlobalRateLimit({ scope: "applicationGeneration", userId, ...RATE_LIMITS.applicationGeneration });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const application = await ensureApplicationPackage(userId, id);
  return NextResponse.json({ applicationId: application.id });
}
