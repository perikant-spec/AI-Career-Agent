import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage/localDisk";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const resume = await prisma.resumeDocument.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.resumeDocument.delete({ where: { id } });
  await storage.delete(resume.storageKey).catch(() => {
    // File may already be gone — deleting the DB record is the source of truth for the user.
  });

  return NextResponse.json({ success: true });
}
