import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { APPLICATION_STATUSES } from "@/lib/types/enums";
import { ensureFollowUpForApplication } from "@/lib/followups/ensureFollowUp";
import { ensureInterviewPrep } from "@/lib/interview/generateInterviewPrep";
import { assertProFeature } from "@/lib/billing/entitlements";

const statusSchema = z.object({ status: z.enum(APPLICATION_STATUSES) });

/** Manual, user-driven only — no automated status detection exists in this milestone, and none
 *  is silently inferred here. Setting APPLIED records the human-submission confirmation moment
 *  (PRD §19 Journey A): the agent prepares, the user applies and confirms, never the reverse. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.application.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { status } = parsed.data;
  const appliedAt = status === "APPLIED" && !existing.appliedAt ? new Date() : existing.appliedAt;
  const updated = await prisma.application.update({
    where: { id },
    data: { status, appliedAt },
  });

  // Auto-schedule the follow-up timer the moment an application first becomes Applied — the
  // PRD's "Application submitted → wait N days → suggest follow-up" flow. Idempotent, so this
  // is safe even if the status flips back and forth.
  if (status === "APPLIED" && appliedAt) {
    await ensureFollowUpForApplication(userId, id, appliedAt);
  }

  // Auto-build interview prep the moment an application first reaches Interview (or Final
  // Interview, in case a candidate skips straight there) — PRD §21. Idempotent per application.
  // Gated the same as the manual interview-prep read: Free tier can still track status through
  // Interview, it just doesn't get prep content generated for free.
  if (status === "INTERVIEW" || status === "FINAL_INTERVIEW") {
    const gate = await assertProFeature(userId, "INTERVIEW_PREP");
    if (gate.allowed) {
      await ensureInterviewPrep(userId, id);
    }
  }

  return NextResponse.json({ status: updated.status, appliedAt: updated.appliedAt });
}
