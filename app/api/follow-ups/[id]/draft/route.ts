import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureFollowUpDraft } from "@/lib/followups/generateFollowUpDraft";

const bodySchema = z.object({ force: z.boolean().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const existing = await prisma.followUp.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  const draft = await ensureFollowUpDraft(userId, id, parsed.success ? (parsed.data.force ?? false) : false);
  return NextResponse.json({ draft });
}
