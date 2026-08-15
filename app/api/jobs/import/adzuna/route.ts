import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdzunaConfigured, searchAdzuna } from "@/lib/jobs/sources/adzuna";
import { extractJobRequirements } from "@/lib/jobs/extractJob";
import { scoreJobForUser } from "@/lib/scoring/scoreJob";
import { assertJobImportAllowed } from "@/lib/billing/entitlements";
import { checkUserAndGlobalRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimits.config";
import { checkAIBudget } from "@/lib/ai/usageLimits";
import { withUsageTracking, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";

const searchSchema = z.object({
  what: z.string().trim().max(200).optional(),
  where: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const rate = checkUserAndGlobalRateLimit({ scope: "jobImportAdzuna", userId, ...RATE_LIMITS.jobImportAdzuna });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

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
  let budgetExhausted = false;

  for (const result of results) {
    // Checked per-iteration, not once for the whole batch — a single import request can trigger
    // dozens of paired extract+score AI calls, so this is the only point that actually caps
    // worst-case spend from one request.
    const budget = await checkAIBudget(userId);
    if (!budget.allowed) {
      budgetExhausted = true;
      break;
    }

    const rawText = `${result.title}\n\n${result.company} — ${result.location}\n\n${result.description}`;
    const tracked = await withUsageTracking(() => extractJobRequirements(rawText));
    const extraction = tracked.result;
    const jobExtractUsage = summarizeUsage(tracked.usage);

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

    await prisma.aIInteraction.create({
      data: {
        userId,
        toolName: "job.extract",
        provider: extraction.provider,
        providerVersion: extraction.providerVersion,
        inputRef: job.id,
        outputRef: `title=${extraction.title ?? "?"}`,
        status: "SUCCESS",
        inputTokens: jobExtractUsage.inputTokens,
        outputTokens: jobExtractUsage.outputTokens,
        estimatedCostUsd: estimateCostUsd(jobExtractUsage.model, jobExtractUsage.inputTokens, jobExtractUsage.outputTokens),
      },
    });

    await scoreJobForUser(userId, job.id);
    created.push(job.id);
  }

  return NextResponse.json({
    configured: true,
    imported: created.length,
    ...(budgetExhausted && {
      note: "Daily AI usage limit reached — stopped importing early. The rest can be imported once the limit resets.",
    }),
  });
}
