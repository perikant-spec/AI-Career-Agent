import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { OUTREACH_MESSAGE_TYPES, OUTREACH_MESSAGE_STATUSES } from "@/lib/types/enums";
import { ensureOutreachMessage } from "@/lib/networking/generateOutreachMessage";
import { assertProFeature } from "@/lib/billing/entitlements";

const generateSchema = z.object({
  messageType: z.enum(OUTREACH_MESSAGE_TYPES),
  force: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const contact = await prisma.contact.findFirst({ where: { id, userId } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message type." }, { status: 400 });
  }

  const gate = await assertProFeature(userId, "NETWORKING_OUTREACH");
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgradeRequired: true }, { status: 402 });
  }

  const message = await ensureOutreachMessage(userId, id, parsed.data.messageType, parsed.data.force ?? false);
  return NextResponse.json({ message });
}

const updateSchema = z.object({
  messageType: z.enum(OUTREACH_MESSAGE_TYPES),
  content: z.string().trim().min(1).max(3000).optional(),
  status: z.enum(OUTREACH_MESSAGE_STATUSES).optional(),
});

/** The only path that can set status to SENT — always an explicit user action here, never
 *  triggered by generation and never by anything that actually dispatches a message anywhere. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const contact = await prisma.contact.findFirst({ where: { id, userId } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const existing = await prisma.outreachMessage.findUnique({
    where: { contactId_messageType: { contactId: id, messageType: parsed.data.messageType } },
  });
  if (!existing) return NextResponse.json({ error: "No draft exists for that message type yet." }, { status: 404 });

  const data: { content?: string; citedEntityIds?: string; status?: string; sentAt?: Date | null } = {};
  if (parsed.data.content !== undefined) {
    // A manual edit has no single span to re-check the way a profile field does — same rule
    // already applied to cover letters/Q&A: clear citations rather than claim a guarantee the
    // edit can't actually make.
    data.content = parsed.data.content;
    data.citedEntityIds = "[]";
  }
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    data.sentAt = parsed.data.status === "SENT" ? (existing.sentAt ?? new Date()) : null;
  }

  const updated = await prisma.outreachMessage.update({ where: { id: existing.id }, data });
  return NextResponse.json({
    message: {
      id: updated.id,
      messageType: updated.messageType,
      content: updated.content,
      citedEntityIds: JSON.parse(updated.citedEntityIds),
      status: updated.status,
      sentAt: updated.sentAt,
    },
  });
}
