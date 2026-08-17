import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { computeBriefing } from "@/lib/briefing/computeBriefing";
import { buildBriefingNarrative } from "@/lib/briefing/narrative";

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const facts = await computeBriefing(userId);
  const narrative = buildBriefingNarrative(facts);

  return NextResponse.json({
    headline: narrative.cardHeadline,
    lines: narrative.cardLines,
    facts,
  });
}
