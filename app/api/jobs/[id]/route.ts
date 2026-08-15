import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { buildProfileSnapshot } from "@/lib/profile/profileSnapshot";
import { scoreJobForUser } from "@/lib/scoring/scoreJob";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, userId },
    include: { matchScores: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let matchScore = job.matchScores[0] ?? null;

  // Auto-recompute if the profile has changed since this score was last computed — the score
  // shown should never silently drift out of sync with what the profile now actually says.
  if (matchScore) {
    const profileEntries = await prisma.careerProfileEntry.findMany({ where: { userId } });
    const currentHash = buildProfileSnapshot(profileEntries).versionHash;
    if (currentHash !== matchScore.profileVersionHash) {
      await scoreJobForUser(userId, id);
      // scoreJobForUser always upserts a row for this exact (userId, jobId) pair, so this is
      // guaranteed to exist — re-fetched fresh rather than reshaping PersistedMatchScore's
      // slightly different field shapes back into the Prisma row type.
      matchScore = await prisma.matchScore.findUniqueOrThrow({
        where: { userId_jobId: { userId, jobId: id } },
      });
    }
  }

  return NextResponse.json({
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      locationText: job.locationText,
      rawText: job.rawText,
      parsedRequirements: job.parsedRequirements ? JSON.parse(job.parsedRequirements) : null,
      extractionConfidence: job.extractionConfidence,
      createdAt: job.createdAt,
    },
    matchScore: matchScore
      ? {
          overallScore: matchScore.overallScore,
          categoryScores: JSON.parse(matchScore.categoryScores),
          strengths: JSON.parse(matchScore.strengths),
          gaps: JSON.parse(matchScore.gaps),
          disqualifiers: JSON.parse(matchScore.disqualifiers),
          recommendationTier: matchScore.recommendationTier,
          confidenceNote: matchScore.confidenceNote,
        }
      : null,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.job.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
