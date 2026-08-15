import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdzunaConfigured, searchAdzuna } from "@/lib/jobs/sources/adzuna";
import { extractJobRequirements } from "@/lib/jobs/extractJob";
import { scoreJobForUser } from "@/lib/scoring/scoreJob";
import { assertJobImportAllowed } from "@/lib/billing/entitlements";

const searchSchema = z.object({
  what: z.string().trim().max(200).optional(),
  where: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  if (!isAdzunaConfigured()) {
    // Never silently attempted — the caller (Settings page) checks /api/job-sources first, but
    // this is the actual enforcement point.
    return NextResponse.json({ configured: false });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const results = await searchAdzuna(parsed.data);

  const gate = await assertJobImportAllowed(userId, results.length);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgradeRequired: true }, { status: 402 });
  }

  const created: string[] = [];

  for (const result of results) {
    const rawText = `${result.title}\n\n${result.company} — ${result.location}\n\n${result.description}`;
    const extraction = await extractJobRequirements(rawText);

    const job = await prisma.job.create({
      data: {
        userId,
        source: "ADZUNA",
        sourceRef: result.redirectUrl,
        rawText,
        title: result.title || extraction.title,
        company: result.company || extraction.company,
        locationText: result.location,
        parsedRequirements: JSON.stringify(extraction.parsedRequirements),
        extractionConfidence: extraction.extractionConfidence,
      },
    });

    await scoreJobForUser(userId, job.id);
    created.push(job.id);
  }

  return NextResponse.json({ configured: true, imported: created.length });
}
