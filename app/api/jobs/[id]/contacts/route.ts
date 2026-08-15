import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CONTACT_TYPES } from "@/lib/types/enums";

const createContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  role: z.string().trim().max(160).optional(),
  contactType: z.enum(CONTACT_TYPES).default("OTHER"),
  relationshipNote: z.string().trim().max(500).optional(),
  warmth: z.number().int().min(0).max(100).optional(),
  profileUrl: z.string().trim().url("Enter a valid URL.").max(500).optional().or(z.literal("")),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contacts = await prisma.contact.findMany({
    where: { userId, jobId: id },
    orderBy: [{ warmth: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ contacts });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { profileUrl, ...rest } = parsed.data;
  const contact = await prisma.contact.create({
    data: { ...rest, profileUrl: profileUrl || null, userId, jobId: id },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
