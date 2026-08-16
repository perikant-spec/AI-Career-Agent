import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scoreJobForUser } from "@/lib/scoring/scoreJob";
import { checkUserAndGlobalRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimits.config";
import { checkAIBudget } from "@/lib/ai/usageLimits";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rate = checkUserAndGlobalRateLimit({ scope: "jobRescore", userId, ...RATE_LIMITS.jobRescore });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const budget = await checkAIBudget(userId);
  if (!budget.allowed) {
    return NextResponse.json({ error: budget.reason }, { status: 429 });
  }

  const matchScore = await scoreJobForUser(userId, id);
  return NextResponse.json({ matchScore });
}
