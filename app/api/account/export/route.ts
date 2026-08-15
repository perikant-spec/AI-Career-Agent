import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";

/** A full, self-service export of everything this app stores about the caller — every model
 *  with a userId FK, minus secrets (passwordHash, reset-token hash) and raw uploaded file bytes
 *  (the resume's extracted text is included; the original PDF/DOCX binary isn't, since a JSON
 *  export isn't the right container for that — re-upload if you need the original file back). */
export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    user,
    resumes,
    profileEntries,
    jobs,
    matchScores,
    resumeVersions,
    applications,
    contacts,
    outreachMessages,
    followUps,
    interviewPreps,
    mockInterviewAttempts,
    preferences,
    subscription,
    aiInteractions,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        privacyAcceptedAt: true,
        privacyVersion: true,
      },
    }),
    prisma.resumeDocument.findMany({ where: { userId } }),
    prisma.careerProfileEntry.findMany({ where: { userId } }),
    prisma.job.findMany({ where: { userId } }),
    prisma.matchScore.findMany({ where: { userId } }),
    prisma.resumeVersion.findMany({ where: { userId } }),
    prisma.application.findMany({ where: { userId } }),
    prisma.contact.findMany({ where: { userId } }),
    prisma.outreachMessage.findMany({ where: { userId } }),
    prisma.followUp.findMany({ where: { userId } }),
    prisma.interviewPrep.findMany({ where: { userId }, include: { questions: { include: { mockAttempts: true } } } }),
    prisma.mockInterviewAttempt.findMany({ where: { userId } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.aIInteraction.findMany({ where: { userId } }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- storageKey is the thing being stripped out
  const resumesRedacted = resumes.map(({ storageKey, ...rest }) => rest);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    user,
    resumes: resumesRedacted,
    careerProfileEntries: profileEntries,
    jobs,
    matchScores,
    resumeVersions,
    applications,
    contacts,
    outreachMessages,
    followUps,
    interviewPreps,
    mockInterviewAttempts,
    preferences,
    subscription,
    aiInteractions,
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ai-career-agent-export-${userId}.json"`,
    },
  });
}
