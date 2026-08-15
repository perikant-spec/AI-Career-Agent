import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const entry = await prisma.careerProfileEntry.findFirst({ where: { id, userId: session.user.id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.careerProfileEntry.update({
    where: { id },
    data: { userConfirmed: true },
  });

  return NextResponse.json({ entry: updated });
}
