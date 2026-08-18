import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { currentLocalHourAndDate } from "@/lib/time";
import { computeBriefing } from "@/lib/briefing/computeBriefing";
import { buildBriefingNarrative } from "@/lib/briefing/narrative";
import { isEligibleForBriefing } from "@/lib/briefing/cronEligibility";
import { getPushProvider } from "@/lib/push";

/** Deliberately not added to lib/env.ts's REQUIRED_VARS -- local dev/tests that never call this
 *  route should keep booting without CRON_SECRET set at all. Timing-safe compare so a byte-length
 *  mismatch or early-exit character comparison can't leak how much of the secret a guess got
 *  right. */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Hourly-triggered by .github/workflows/daily-briefing-cron.yml. Per-user eligibility (their own
 *  local morning window, not already sent today) is decided here rather than server-side "who's
 *  due" query, since only a handful of users will ever be eligible on a given tick and computing
 *  the facts for everyone-with-a-token is cheap at this app's scale. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const usersWithTokens = await prisma.user.findMany({
    where: { pushTokens: { some: {} } },
    select: {
      id: true,
      preferences: { select: { timezone: true } },
      pushTokens: { select: { token: true } },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const user of usersWithTokens) {
    const timezone = user.preferences?.timezone ?? "UTC";
    const { hour, localDate } = currentLocalHourAndDate(timezone, now);

    const existingLog = await prisma.dailyBriefingLog.findUnique({
      where: { userId_localDate: { userId: user.id, localDate } },
    });

    if (!isEligibleForBriefing({ currentLocalHour: hour, alreadySentToday: !!existingLog })) {
      skipped++;
      continue;
    }

    const facts = await computeBriefing(user.id, now);
    const narrative = buildBriefingNarrative(facts, now);

    await getPushProvider().sendPush(
      user.pushTokens.map((t) => ({ to: t.token, title: narrative.pushTitle, body: narrative.pushBody }))
    );

    try {
      // The @@unique([userId, localDate]) constraint is the real dedup guarantee even under
      // overlapping cron runs -- a concurrent tick that also passed the eligibility check above
      // would lose this race and throw here, which is treated as "already sent," not an error.
      await prisma.dailyBriefingLog.create({ data: { userId: user.id, localDate } });
      sent++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ processed: usersWithTokens.length, sent, skipped });
}
