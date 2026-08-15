import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { ensureInterviewPrep } from "@/lib/interview/generateInterviewPrep";
import { assertProFeature } from "@/lib/billing/entitlements";

function serialize(prep: {
  id: string;
  companyResearch: string;
  questions: Array<{
    id: string;
    category: string;
    question: string;
    orderIndex: number;
    starSituation: string | null;
    starTask: string | null;
    starAction: string | null;
    starResult: string | null;
    citedEntityIds: string;
    rehearsed: boolean;
    mockAttempts: Array<{
      id: string;
      responseText: string;
      scoreRelevance: number;
      scoreClarity: number;
      scoreStructure: number;
      scoreCompleteness: number;
      feedback: string;
      createdAt: Date;
    }>;
  }>;
}) {
  const questions = [...prep.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const readiness =
    questions.length > 0 ? Math.round((questions.filter((q) => q.rehearsed).length / questions.length) * 100) : 0;

  return {
    id: prep.id,
    companyResearch: JSON.parse(prep.companyResearch),
    readiness,
    rehearsedCount: questions.filter((q) => q.rehearsed).length,
    totalCount: questions.length,
    questions: questions.map((q) => ({
      id: q.id,
      category: q.category,
      question: q.question,
      star: { situation: q.starSituation, task: q.starTask, action: q.starAction, result: q.starResult },
      citedEntityIds: JSON.parse(q.citedEntityIds),
      rehearsed: q.rehearsed,
      mockAttempts: q.mockAttempts
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((a) => ({
          id: a.id,
          responseText: a.responseText,
          scoreRelevance: a.scoreRelevance,
          scoreClarity: a.scoreClarity,
          scoreStructure: a.scoreStructure,
          scoreCompleteness: a.scoreCompleteness,
          feedback: a.feedback,
          createdAt: a.createdAt,
        })),
    })),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const application = await prisma.application.findFirst({ where: { id, userId } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isInterviewStage = application.status === "INTERVIEW" || application.status === "FINAL_INTERVIEW";
  if (!isInterviewStage) {
    return NextResponse.json({ interviewPrep: null, eligible: false });
  }

  // Generation (not mere existence) is the gated action — prep already generated before a plan
  // lapsed is still shown, but a Free-tier application that never had prep built doesn't get one
  // built on this read.
  const existing = await prisma.interviewPrep.findUnique({ where: { applicationId: id } });
  if (!existing) {
    const gate = await assertProFeature(userId, "INTERVIEW_PREP");
    if (!gate.allowed) {
      return NextResponse.json({ interviewPrep: null, eligible: true, upgradeRequired: true, error: gate.reason });
    }
  }

  // Lazy-create for resilience — same pattern as resume-version/application-package generation —
  // in case this application reached Interview status before this feature existed, or a prior
  // generation attempt failed.
  await ensureInterviewPrep(userId, id);

  const prep = await prisma.interviewPrep.findUniqueOrThrow({
    where: { applicationId: id },
    include: { questions: { include: { mockAttempts: true } } },
  });

  return NextResponse.json({ interviewPrep: serialize(prep), eligible: true });
}
