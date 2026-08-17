import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createWebSession } from "./helpers/webSession";
import { currentLocalHourAndDate } from "@/lib/time";

// Proves the real DB wiring of the whole daily-briefing pipeline (route -> lib/briefing ->
// lib/push -> PushLog/DailyBriefingLog) against real Postgres, the way tests/unit/briefing/*
// can't (those never touch Prisma or the actual cron route). Requires the running dev server to
// have EXPO_PUSH_DISABLED=true (so no real device push fires) and a real CRON_SECRET set --
// see the "how to run" note in this repo's README/DEPLOYMENT docs.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STEP_TIMEOUT = 30000;
const CRON_SECRET = process.env.CRON_SECRET;

async function serverReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON (status ${res.status}), got: ${text.slice(0, 300)}`);
  }
}

const SAMPLE_JOB_TEXT = `Group Product Manager

Globex is hiring a Group Product Manager to own our activation roadmap.

Location: Remote (US)
Salary: $150,000 - $180,000

Required:
- 6+ years of product management experience
- Strong SQL and stakeholder management skills

This is a senior role. No visa sponsorship is available for this position.`;

// A pool of real, validator-accepted IANA zones spanning nearly every whole-hour UTC offset (most
// deliberately DST-free, so this stays correct year-round) -- picked dynamically in beforeAll so
// this test finds a zone whose CURRENT local hour falls in the cron's [7,9) morning window,
// whatever real time the test suite happens to run at. Offsets are fixed per zone, so the
// relative spacing (max 2h between consecutive entries) holds at any moment, guaranteeing at
// least one match for any 2-hour-wide window.
const TIMEZONE_POOL = [
  "Pacific/Pago_Pago", "Pacific/Honolulu", "Pacific/Gambier", "America/Phoenix", "America/Guatemala",
  "America/Bogota", "America/La_Paz", "America/Montevideo", "Atlantic/Cape_Verde", "Africa/Accra",
  "Africa/Lagos", "Africa/Nairobi", "Asia/Dubai", "Asia/Karachi", "Asia/Dhaka", "Asia/Bangkok",
  "Asia/Shanghai", "Asia/Tokyo", "Australia/Brisbane", "Pacific/Noumea", "Pacific/Funafuti", "Asia/Kolkata",
];

function pickMorningWindowZone(now: Date): string {
  const match = TIMEZONE_POOL.find((tz) => {
    const { hour } = currentLocalHourAndDate(tz, now);
    return hour >= 7 && hour < 9;
  });
  if (!match) throw new Error("No zone in TIMEZONE_POOL currently falls in the [7,9) morning window -- widen the pool.");
  return match;
}

function addDaysToLocalDate(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

describe.runIf(await serverReachable() && !!CRON_SECRET)("Daily Briefing cron -- real DB wiring", () => {
  const email = `e2e-briefing-${Date.now()}@example.com`;
  const password = "e2eTestPass123";
  const pushToken = `ExponentPushToken[e2e-${Date.now()}]`;
  let cookie: string;
  let token: string;
  let userId: string;
  let timezone: string;

  function web(path: string, init: RequestInit = {}) {
    return fetch(`${BASE_URL}${path}`, { ...init, headers: { Cookie: cookie, ...(init.headers ?? {}) } });
  }
  function mobile(path: string, init: RequestInit = {}) {
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  }
  function cron() {
    return fetch(`${BASE_URL}/api/cron/daily-briefing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
  }

  beforeAll(async () => {
    expect(await serverReachable()).toBe(true);

    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Briefing Test", acceptedLegal: true }),
    });
    expect(registerRes.status).toBe(201);
    userId = (await json<{ user: { id: string } }>(registerRes)).user.id;

    cookie = await createWebSession(BASE_URL, email, password);
    const loginRes = await fetch(`${BASE_URL}/api/mobile/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    token = (await json<{ token: string }>(loginRes)).token;

    const { prisma } = await import("@/lib/prisma");
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: "PRO", status: "ACTIVE" },
      update: { plan: "PRO", status: "ACTIVE" },
    });

    timezone = pickMorningWindowZone(new Date());
    await web("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });

    await mobile("/api/push-tokens", { method: "POST", body: JSON.stringify({ token: pushToken, platform: "IOS" }) });

    // Job targeting + high priority: a real scored job.
    const jobRes = await mobile("/api/jobs", { method: "POST", body: JSON.stringify({ rawText: SAMPLE_JOB_TEXT }) });
    const jobId = (await json<{ job: { id: string } }>(jobRes)).job.id;

    // Applications + follow-ups due today: apply, then pull the auto-scheduled follow-up's
    // dueDate into today's local range directly (the API's own minimum followUpDays is 1, which
    // would land tomorrow, not today -- same "use Prisma for the one thing the API can't express"
    // convention tenantIsolation.test.ts already uses for its own fixture setup).
    const applyRes = await mobile(`/api/jobs/${jobId}/apply`, { method: "POST" });
    const applicationId = (await json<{ applicationId: string }>(applyRes)).applicationId;
    await mobile(`/api/applications/${applicationId}/status`, { method: "POST", body: JSON.stringify({ status: "APPLIED" }) });
    await prisma.followUp.updateMany({ where: { applicationId }, data: { dueDate: new Date() } });

    // Networking: a HIRING_MANAGER contact with no outreach sent yet.
    await web(`/api/jobs/${jobId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dana Reyes", contactType: "HIRING_MANAGER", warmth: 70 }),
    });

    // Interview, with a real scheduledAt set via the real PATCH endpoint.
    await mobile(`/api/applications/${applicationId}/status`, { method: "POST", body: JSON.stringify({ status: "INTERVIEW" }) });
    const { localDate: todayLocal } = currentLocalHourAndDate(timezone, new Date());
    const scheduledAtLocal = `${addDaysToLocalDate(todayLocal, 1)}T10:00`;
    const scheduleRes = await mobile(`/api/applications/${applicationId}/interview-prep`, {
      method: "PATCH",
      body: JSON.stringify({ scheduledAtLocal }),
    });
    expect(scheduleRes.status).toBe(200);
  }, STEP_TIMEOUT * 3);

  afterAll(async () => {
    if (!userId) return;
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it(
    "sends a real push for this user's morning window, logs it, and never double-sends on a second call",
    async () => {
      const firstRes = await cron();
      expect(firstRes.status).toBe(200);
      const firstBody = await json<{ processed: number; sent: number; skipped: number }>(firstRes);
      expect(firstBody.sent).toBeGreaterThanOrEqual(1);

      const { prisma } = await import("@/lib/prisma");

      const pushLogs = await prisma.pushLog.findMany({ where: { to: pushToken } });
      expect(pushLogs).toHaveLength(1);
      // Real facts made it into the sent copy -- not a placeholder/default message. (Whether this
      // job lands in the APPLY_STRONG tier depends on the scoring heuristic's judgment of the
      // fixture text, so "high priority" isn't asserted here -- these three are guaranteed by
      // what was actually seeded above.)
      expect(pushLogs[0].body).toContain("1 new job");
      expect(pushLogs[0].body).toContain("Dana Reyes");
      expect(pushLogs[0].body).toMatch(/interview with Globex tomorrow at \d{1,2}:\d{2}\s*(AM|PM)/i);

      const { localDate: todayLocal } = currentLocalHourAndDate(timezone, new Date());
      const log = await prisma.dailyBriefingLog.findUnique({ where: { userId_localDate: { userId, localDate: todayLocal } } });
      expect(log).not.toBeNull();

      // Dedup proof: an immediate second call must not send (or log) again for this user.
      const secondRes = await cron();
      const secondBody = await json<{ processed: number; sent: number; skipped: number }>(secondRes);
      expect(secondBody.sent).toBe(0);

      const pushLogsAfter = await prisma.pushLog.findMany({ where: { to: pushToken } });
      expect(pushLogsAfter).toHaveLength(1); // unchanged
    },
    STEP_TIMEOUT * 2
  );

  it(
    "GET /api/daily-briefing (the in-app card) reflects the same real facts",
    async () => {
      const res = await mobile("/api/daily-briefing");
      expect(res.status).toBe(200);
      const body = await json<{ lines: string[]; facts: { upcomingInterview: { hasTime: boolean } | null } }>(res);
      expect(body.lines.join(" ")).toContain("Dana Reyes");
      expect(body.facts.upcomingInterview?.hasTime).toBe(true);
    },
    STEP_TIMEOUT
  );
});
