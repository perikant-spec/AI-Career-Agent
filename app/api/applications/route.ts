import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const applications = await prisma.application.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { job: { include: { matchScores: true } } },
  });

  return NextResponse.json({
    applications: applications.map((app) => ({
      id: app.id,
      jobId: app.jobId,
      status: app.status,
      title: app.job.title,
      company: app.job.company,
      score: app.job.matchScores[0]?.overallScore ?? null,
      recommendationTier: app.job.matchScores[0]?.recommendationTier ?? null,
      notes: app.notes,
      updatedAt: app.updatedAt,
      appliedAt: app.appliedAt,
      // Package generated but not yet fully reviewed — what the dashboard calls "ready for review".
      packageReady: !!app.coverLetterContent && !(app.resumeApproved && app.coverLetterApproved && app.qaApproved),
    })),
  });
}
