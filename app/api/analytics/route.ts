import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { computeAnalytics } from "@/lib/analytics/computeAnalytics";

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await computeAnalytics(userId);
  return NextResponse.json({ summary });
}
