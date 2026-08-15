import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  targetTitles: z.array(z.string().trim().min(1)).max(20).optional(),
  targetLocations: z.array(z.string().trim().min(1)).max(20).optional(),
  salaryFloor: z.number().int().positive().optional().nullable(),
  workAuthorization: z.string().trim().max(500).optional().nullable(),
  followUpDays: z.number().int().min(1).max(90).optional(),
  aiTrainingOptIn: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await prisma.userPreferences.findUnique({ where: { userId: session.user.id } });

  return NextResponse.json({
    preferences: prefs
      ? {
          targetTitles: prefs.targetTitles ? JSON.parse(prefs.targetTitles) : [],
          targetLocations: prefs.targetLocations ? JSON.parse(prefs.targetLocations) : [],
          salaryFloor: prefs.salaryFloor,
          workAuthorization: prefs.workAuthorization,
          followUpDays: prefs.followUpDays,
          aiTrainingOptIn: prefs.aiTrainingOptIn,
        }
      : {
          targetTitles: [],
          targetLocations: [],
          salaryFloor: null,
          workAuthorization: null,
          followUpDays: 7,
          aiTrainingOptIn: false,
        },
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { targetTitles, targetLocations, salaryFloor, workAuthorization, followUpDays, aiTrainingOptIn } = parsed.data;

  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      targetTitles: targetTitles ? JSON.stringify(targetTitles) : undefined,
      targetLocations: targetLocations ? JSON.stringify(targetLocations) : undefined,
      salaryFloor: salaryFloor ?? undefined,
      workAuthorization: workAuthorization ?? undefined,
      followUpDays: followUpDays ?? undefined,
      aiTrainingOptIn: aiTrainingOptIn ?? undefined,
    },
    update: {
      targetTitles: targetTitles ? JSON.stringify(targetTitles) : undefined,
      targetLocations: targetLocations ? JSON.stringify(targetLocations) : undefined,
      salaryFloor: salaryFloor === null ? null : salaryFloor,
      workAuthorization: workAuthorization === null ? null : workAuthorization,
      followUpDays: followUpDays ?? undefined,
      aiTrainingOptIn: aiTrainingOptIn ?? undefined,
    },
  });

  return NextResponse.json({
    preferences: {
      targetTitles: prefs.targetTitles ? JSON.parse(prefs.targetTitles) : [],
      targetLocations: prefs.targetLocations ? JSON.parse(prefs.targetLocations) : [],
      salaryFloor: prefs.salaryFloor,
      workAuthorization: prefs.workAuthorization,
      followUpDays: prefs.followUpDays,
      aiTrainingOptIn: prefs.aiTrainingOptIn,
    },
  });
}
