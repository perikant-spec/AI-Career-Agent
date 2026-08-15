import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pinManualEntryConfidence } from "@/lib/evidence/validator";
import { PROFILE_SECTIONS } from "@/lib/types/enums";

const createSchema = z.object({
  section: z.enum(PROFILE_SECTIONS),
  value: z.string().trim().min(1).max(2000),
  label: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { section, value, label } = parsed.data;
  const orderIndex = await prisma.careerProfileEntry.count({ where: { userId } });

  // A user cannot self-declare a higher confidence — there is no source document backing a
  // manually-typed entry, so it's hard-pinned regardless of what the client sent.
  const entry = await prisma.careerProfileEntry.create({
    data: {
      userId,
      section,
      value,
      label: label ?? value,
      confidence: pinManualEntryConfidence(),
      userConfirmed: true,
      userEdited: true,
      orderIndex,
    },
  });

  return NextResponse.json({ entry });
}
