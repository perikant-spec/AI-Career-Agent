import { prisma } from "@/lib/prisma";
import { computeFollowUpDueDate } from "./dueDate";

/**
 * Auto-scheduled the moment an application's status becomes Applied (PRD §21 flow: "Application
 * submitted → wait N days → suggest follow-up"). Idempotent per application — if one already
 * exists (pending or resolved), this does nothing, so re-triggering the Applied transition never
 * spawns duplicates. Uses the user's own followUpDays preference (default 7), never a hardcoded
 * number baked past the config layer.
 */
export async function ensureFollowUpForApplication(userId: string, applicationId: string, appliedAt: Date): Promise<void> {
  const existing = await prisma.followUp.findFirst({ where: { applicationId } });
  if (existing) return;

  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
  const days = prefs?.followUpDays ?? 7;

  await prisma.followUp.create({
    data: { userId, applicationId, dueDate: computeFollowUpDueDate(appliedAt, days) },
  });
}
