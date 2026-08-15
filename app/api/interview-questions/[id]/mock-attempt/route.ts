import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { scoreMockAttempt } from "@/lib/interview/scoreMockAttempt";
import { checkUserAndGlobalRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimits.config";

const bodySchema = z.object({ responseText: z.string().trim().min(1, "Type a response first.").max(4000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const question = await prisma.interviewQuestion.findFirst({ where: { id, interviewPrep: { userId } } });
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rate = checkUserAndGlobalRateLimit({ scope: "mockInterviewScoring", userId, ...RATE_LIMITS.mockInterviewScoring });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const attempt = await scoreMockAttempt(userId, id, parsed.data.responseText);
  return NextResponse.json({ attempt });
}
