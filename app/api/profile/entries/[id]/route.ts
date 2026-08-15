import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateEntry, pinManualEntryConfidence } from "@/lib/evidence/validator";
import type { ConfidenceLevel } from "@/lib/types/enums";

const updateSchema = z.object({
  value: z.string().trim().min(1).max(2000),
  label: z.string().trim().max(200).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const entry = await prisma.careerProfileEntry.findFirst({
    where: { id, userId },
    include: { sourceDocument: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { value, label } = parsed.data;

  // Re-run the Evidence Validator against the *current* source text on every edit — a user
  // correcting a typo can only keep or lose confidence, never grant themselves a higher one
  // than what the text actually supports. Entries with no backing document (manual adds) are
  // hard-pinned regardless of what they're edited to.
  let confidence: ConfidenceLevel;
  let sourceSpanStart: number | null = entry.sourceSpanStart;
  let sourceSpanEnd: number | null = entry.sourceSpanEnd;
  let sourceSpanText: string | null = entry.sourceSpanText;

  if (entry.sourceDocument) {
    const validation = validateEntry(
      { value, confidence: entry.confidence as ConfidenceLevel },
      entry.sourceDocument.rawText
    );
    confidence = validation.confidence;
    if (validation.matchedVia === "EXACT" && validation.span) {
      sourceSpanStart = validation.span.start;
      sourceSpanEnd = validation.span.end;
      sourceSpanText = validation.span.text;
    } else {
      // The edited value no longer matches the span it used to cite — don't keep showing a
      // stale citation next to text it no longer corresponds to.
      sourceSpanStart = null;
      sourceSpanEnd = null;
      sourceSpanText = null;
    }
  } else {
    confidence = pinManualEntryConfidence();
  }

  const updated = await prisma.careerProfileEntry.update({
    where: { id },
    data: {
      value,
      label: label ?? entry.label,
      confidence,
      sourceSpanStart,
      sourceSpanEnd,
      sourceSpanText,
      userEdited: true,
    },
  });

  return NextResponse.json({ entry: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const entry = await prisma.careerProfileEntry.findFirst({ where: { id, userId: session.user.id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.careerProfileEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
