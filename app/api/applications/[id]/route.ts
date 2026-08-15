import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { ensureApplicationPackage } from "@/lib/application/generateApplicationPackage";
import { assertProFeature } from "@/lib/billing/entitlements";

function serialize(app: {
  id: string;
  jobId: string;
  status: string;
  coverLetterContent: string | null;
  qaAnswers: string | null;
  resumeApproved: boolean;
  coverLetterApproved: boolean;
  qaApproved: boolean;
  notes: string | null;
  discoveredAt: Date;
  appliedAt: Date | null;
  job: { title: string | null; company: string | null; matchScores: Array<{ overallScore: number; recommendationTier: string }> };
}) {
  return {
    id: app.id,
    jobId: app.jobId,
    status: app.status,
    job: { title: app.job.title, company: app.job.company },
    score: app.job.matchScores[0]?.overallScore ?? null,
    recommendationTier: app.job.matchScores[0]?.recommendationTier ?? null,
    coverLetter: app.coverLetterContent ? JSON.parse(app.coverLetterContent) : null,
    qaAnswers: app.qaAnswers ? JSON.parse(app.qaAnswers) : null,
    resumeApproved: app.resumeApproved,
    coverLetterApproved: app.coverLetterApproved,
    qaApproved: app.qaApproved,
    notes: app.notes,
    discoveredAt: app.discoveredAt,
    appliedAt: app.appliedAt,
  };
}

async function loadForUser(id: string, userId: string) {
  return prisma.application.findFirst({
    where: { id, userId },
    include: { job: { include: { matchScores: true } } },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const app = await loadForUser(id, userId);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const resumeVersion = await prisma.resumeVersion.findUnique({
    where: { userId_jobId: { userId, jobId: app.jobId } },
  });

  return NextResponse.json({
    application: serialize(app),
    resumeVersion: resumeVersion
      ? {
          content: JSON.parse(resumeVersion.content),
          changeLog: JSON.parse(resumeVersion.changeLog),
          atsScoreBefore: resumeVersion.atsScoreBefore,
          atsScoreAfter: resumeVersion.atsScoreAfter,
        }
      : null,
  });
}

const patchSchema = z.object({
  resumeApproved: z.boolean().optional(),
  coverLetterApproved: z.boolean().optional(),
  qaApproved: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
  regenerate: z.enum(["resume", "coverLetter", "qa"]).optional(),
  // Manual edits to AI-generated prose — free text has no single span to re-check against the
  // Evidence Validator the way a profile field does, so an edit simply clears citedEntityIds
  // rather than claiming a validation guarantee it can't actually make.
  coverLetterText: z.string().max(4000).optional(),
  qaAnswerEdit: z.object({ index: z.number().int().min(0), answer: z.string().max(2000) }).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await loadForUser(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  if (parsed.data.regenerate) {
    const gate = await assertProFeature(userId, "APPLICATION_PACKAGE");
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeRequired: true }, { status: 402 });
    }

    const piece = parsed.data.regenerate;
    await ensureApplicationPackage(userId, existing.jobId, {
      forceResume: piece === "resume",
      forceCoverLetter: piece === "coverLetter",
      forceQa: piece === "qa",
    });
    // Regenerated content invalidates any prior approval on that piece.
    const unapproveField =
      piece === "resume" ? "resumeApproved" : piece === "coverLetter" ? "coverLetterApproved" : "qaApproved";
    await prisma.application.update({ where: { id }, data: { [unapproveField]: false } });
  } else if (parsed.data.coverLetterText !== undefined) {
    await prisma.application.update({
      where: { id },
      data: {
        coverLetterContent: JSON.stringify({ content: parsed.data.coverLetterText, citedEntityIds: [] }),
        coverLetterApproved: false,
      },
    });
  } else if (parsed.data.qaAnswerEdit) {
    const current = existing.qaAnswers ? JSON.parse(existing.qaAnswers) : [];
    const { index, answer } = parsed.data.qaAnswerEdit;
    if (current[index]) {
      current[index] = { ...current[index], answer, citedEntityIds: [] };
    }
    await prisma.application.update({
      where: { id },
      data: { qaAnswers: JSON.stringify(current), qaApproved: false },
    });
  } else {
    const { resumeApproved, coverLetterApproved, qaApproved, notes } = parsed.data;
    await prisma.application.update({
      where: { id },
      data: { resumeApproved, coverLetterApproved, qaApproved, notes },
    });
  }

  const app = await loadForUser(id, userId);
  const resumeVersion = await prisma.resumeVersion.findUnique({
    where: { userId_jobId: { userId, jobId: existing.jobId } },
  });

  return NextResponse.json({
    application: serialize(app!),
    resumeVersion: resumeVersion
      ? {
          content: JSON.parse(resumeVersion.content),
          changeLog: JSON.parse(resumeVersion.changeLog),
          atsScoreBefore: resumeVersion.atsScoreBefore,
          atsScoreAfter: resumeVersion.atsScoreAfter,
        }
      : null,
  });
}
