import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { CONTACT_TYPES, OUTREACH_MESSAGE_TYPES } from "@/lib/types/enums";

async function loadForUser(id: string, userId: string) {
  return prisma.contact.findFirst({
    where: { id, userId },
    include: { job: true, messages: true },
  });
}

function serialize(contact: NonNullable<Awaited<ReturnType<typeof loadForUser>>>) {
  return {
    id: contact.id,
    jobId: contact.jobId,
    jobTitle: contact.job.title,
    company: contact.job.company,
    name: contact.name,
    role: contact.role,
    contactType: contact.contactType,
    source: contact.source,
    relationshipNote: contact.relationshipNote,
    warmth: contact.warmth,
    profileUrl: contact.profileUrl,
    messages: Object.fromEntries(
      OUTREACH_MESSAGE_TYPES.map((type) => {
        const m = contact.messages.find((msg) => msg.messageType === type);
        return [
          type,
          m
            ? {
                id: m.id,
                content: m.content,
                citedEntityIds: JSON.parse(m.citedEntityIds),
                status: m.status,
                sentAt: m.sentAt,
              }
            : null,
        ];
      })
    ),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const contact = await loadForUser(id, userId);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ contact: serialize(contact) });
}

const updateContactSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().max(160).nullable().optional(),
  contactType: z.enum(CONTACT_TYPES).optional(),
  relationshipNote: z.string().trim().max(500).nullable().optional(),
  warmth: z.number().int().min(0).max(100).nullable().optional(),
  profileUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await loadForUser(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { profileUrl, ...rest } = parsed.data;
  await prisma.contact.update({
    where: { id },
    data: { ...rest, ...(profileUrl !== undefined ? { profileUrl: profileUrl || null } : {}) },
  });

  const updated = await loadForUser(id, userId);
  return NextResponse.json({ contact: serialize(updated!) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.contact.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
