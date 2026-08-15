import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const resume = await prisma.resumeDocument.findFirst({ where: { id, userId } });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.resumeDocument.updateMany({ where: { userId }, data: { isMaster: false } }),
    prisma.resumeDocument.update({ where: { id }, data: { isMaster: true } }),
  ]);

  return NextResponse.json({ success: true });
}
