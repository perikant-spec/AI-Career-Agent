import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ConfidenceLevel } from "@/lib/types/enums";
import { computeConfidenceScore } from "@/lib/health/subScorers";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.careerProfileEntry.findMany({
    where: { userId: session.user.id },
    orderBy: [{ section: "asc" }, { orderIndex: "asc" }],
  });

  const bySection: Record<string, typeof entries> = {};
  for (const entry of entries) {
    (bySection[entry.section] ??= []).push(entry);
  }

  const counts = { VERIFIED: 0, SUPPORTED_INFERENCE: 0, NOT_VERIFIED: 0, MISSING: 0 };
  for (const entry of entries) {
    counts[entry.confidence as ConfidenceLevel] = (counts[entry.confidence as ConfidenceLevel] ?? 0) + 1;
  }

  const overallConfidence = computeConfidenceScore(
    entries.map((e) => ({ confidence: e.confidence as ConfidenceLevel }))
  );

  return NextResponse.json({
    sections: bySection,
    counts,
    overallConfidence,
    totalEntries: entries.length,
  });
}
