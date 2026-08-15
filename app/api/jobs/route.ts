import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { extractJobRequirements } from "@/lib/jobs/extractJob";
import { scoreJobForUser } from "@/lib/scoring/scoreJob";
import { assertJobImportAllowed } from "@/lib/billing/entitlements";
import { checkUserAndGlobalRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimits.config";

const createSchema = z.object({
  rawText: z.string().trim().min(10, "Paste the full job posting text — that was too short."),
  sourceRef: z.string().trim().max(2000).optional(),
});

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { matchScores: true, applications: true },
  });

  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      locationText: job.locationText,
      source: job.source,
      createdAt: job.createdAt,
      score: job.matchScores[0]
        ? {
            overallScore: job.matchScores[0].overallScore,
            recommendationTier: job.matchScores[0].recommendationTier,
          }
        : null,
      applicationStatus: job.applications[0]?.status ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { rawText, sourceRef } = parsed.data;

  const rate = checkUserAndGlobalRateLimit({ scope: "jobImport", userId, ...RATE_LIMITS.jobImport });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const gate = await assertJobImportAllowed(userId);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgradeRequired: true }, { status: 402 });
  }

  let extraction;
  try {
    extraction = await extractJobRequirements(rawText);
  } catch (err) {
    await prisma.aIInteraction.create({
      data: {
        userId,
        toolName: "job.extract",
        provider: "unknown",
        inputRef: "n/a",
        outputRef: "",
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });
    return NextResponse.json({ error: "Couldn't parse this job posting. Please try again." }, { status: 500 });
  }

  const job = await prisma.job.create({
    data: {
      userId,
      source: "MANUAL_PASTE",
      sourceRef,
      rawText,
      title: extraction.title,
      company: extraction.company,
      locationText: extraction.location ?? extraction.parsedRequirements.locationText,
      parsedRequirements: JSON.stringify(extraction.parsedRequirements),
      extractionConfidence: extraction.extractionConfidence,
    },
  });

  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: "job.extract",
      provider: extraction.provider,
      providerVersion: extraction.providerVersion,
      inputRef: job.id,
      outputRef: `title=${extraction.title ?? "?"}`,
      status: "SUCCESS",
    },
  });

  const matchScore = await scoreJobForUser(userId, job.id);

  // Every scored job enters the tracker at Discovered — the pipeline's own first stage, not a
  // separate opt-in. Preparing an application later just moves it forward from here.
  await prisma.application.create({ data: { userId, jobId: job.id } });

  return NextResponse.json({ job: { id: job.id, title: job.title, company: job.company }, matchScore });
}
