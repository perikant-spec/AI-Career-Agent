import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FOLLOW_UP_STATUSES } from "@/lib/types/enums";
import { isDue } from "@/lib/followups/dueDate";

async function loadForUser(id: string, userId: string) {
  return prisma.followUp.findFirst({ where: { id, userId }, include: { application: { include: { job: true } } } });
}

function serialize(f: NonNullable<Awaited<ReturnType<typeof loadForUser>>>) {
  return {
    id: f.id,
    applicationId: f.applicationId,
    jobTitle: f.application.job.title,
    company: f.application.job.company,
    applicationStatus: f.application.status,
    dueDate: f.dueDate,
    status: f.status,
    isDue: f.status === "PENDING" && isDue(f.dueDate),
    draftedMessage: f.draftedMessage ? JSON.parse(f.draftedMessage) : null,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const followUp = await loadForUser(id, session.user.id);
  if (!followUp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ followUp: serialize(followUp) });
}

const patchSchema = z.object({
  dueDate: z.string().datetime().optional(),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const existing = await loadForUser(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  await prisma.followUp.update({
    where: { id },
    data: {
      ...(parsed.data.dueDate ? { dueDate: new Date(parsed.data.dueDate) } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
  });

  const updated = await loadForUser(id, userId);
  return NextResponse.json({ followUp: serialize(updated!) });
}
