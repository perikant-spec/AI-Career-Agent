import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { isDue } from "@/lib/followups/dueDate";

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const applicationId = new URL(request.url).searchParams.get("applicationId");

  const followUps = await prisma.followUp.findMany({
    where: { userId, ...(applicationId ? { applicationId } : {}) },
    orderBy: { dueDate: "asc" },
    include: { application: { include: { job: true } } },
  });

  const now = new Date();
  return NextResponse.json({
    followUps: followUps.map((f) => ({
      id: f.id,
      applicationId: f.applicationId,
      jobTitle: f.application.job.title,
      company: f.application.job.company,
      applicationStatus: f.application.status,
      dueDate: f.dueDate,
      status: f.status,
      isDue: f.status === "PENDING" && isDue(f.dueDate, now),
      hasDraft: !!f.draftedMessage,
      draftedMessage: f.draftedMessage ? JSON.parse(f.draftedMessage) : null,
    })),
  });
}
