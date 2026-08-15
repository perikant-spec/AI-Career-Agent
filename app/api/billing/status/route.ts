import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { getUsageSummary } from "@/lib/billing/entitlements";
import { isStripeConfigured } from "@/lib/billing/stripeClient";

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await getUsageSummary(userId);
  return NextResponse.json({ ...summary, stripeConfigured: isStripeConfigured() });
}
