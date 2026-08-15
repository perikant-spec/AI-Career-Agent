import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateResumeVersion } from "@/lib/resume/generateResumeVersion";

function serialize(row: {
  content: string;
  changeLog: string;
  atsScoreBefore: number;
  atsScoreAfter: number;
}) {
  return {
    content: JSON.parse(row.content),
    changeLog: JSON.parse(row.changeLog),
    atsScoreBefore: row.atsScoreBefore,
    atsScoreAfter: row.atsScoreAfter,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.resumeVersion.findUnique({ where: { userId_jobId: { userId, jobId: id } } });
  return NextResponse.json({ resumeVersion: existing ? serialize(existing) : null });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await generateResumeVersion(userId, id);
  return NextResponse.json({
    resumeVersion: {
      content: result.content,
      changeLog: result.changeLog,
      atsScoreBefore: result.atsScoreBefore,
      atsScoreAfter: result.atsScoreAfter,
    },
  });
}
