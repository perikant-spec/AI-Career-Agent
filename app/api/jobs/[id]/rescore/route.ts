import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scoreJobForUser } from "@/lib/scoring/scoreJob";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findFirst({ where: { id, userId: session.user.id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const matchScore = await scoreJobForUser(session.user.id, id);
  return NextResponse.json({ matchScore });
}
