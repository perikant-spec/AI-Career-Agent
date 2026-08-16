import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { getAIProvider } from "@/lib/ai";
import { classifyIntent } from "@/lib/assistant/intentClassifier";
import { whatShouldIApplyToday } from "@/lib/assistant/intents/whatShouldIApplyToday";
import { explainJobScore } from "@/lib/assistant/intents/explainJobScore";
import { customizeResume } from "@/lib/assistant/intents/customizeResume";
import { haveIAppliedBefore } from "@/lib/assistant/intents/haveIAppliedBefore";
import { findContact } from "@/lib/assistant/intents/findContact";
import { prepareForInterview } from "@/lib/assistant/intents/prepareForInterview";
import { whyNotHearingBack } from "@/lib/assistant/intents/whyNotHearingBack";
import { checkUserAndGlobalRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimits.config";
import { checkAIBudget } from "@/lib/ai/usageLimits";
import { withUsageTracking, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";

const chatSchema = z.object({ message: z.string().trim().min(1).max(1000) });

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = checkUserAndGlobalRateLimit({ scope: "assistantChat", userId, ...RATE_LIMITS.assistantChat });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const budget = await checkAIBudget(userId);
  if (!budget.allowed) {
    return NextResponse.json({ error: budget.reason }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { intent, entityQuery } = classifyIntent(parsed.data.message);

  // Every intent maps to exactly one scoped, DB-backed tool call — never a free-form
  // generation. The AI provider below only phrases whatever this returns into prose.
  let toolResults: Record<string, unknown>;
  switch (intent) {
    case "WHAT_SHOULD_I_APPLY_TODAY":
      toolResults = await whatShouldIApplyToday(userId);
      break;
    case "EXPLAIN_JOB_SCORE":
      toolResults = await explainJobScore(userId, entityQuery ?? "");
      break;
    case "CUSTOMIZE_RESUME":
      toolResults = await customizeResume(userId, entityQuery ?? "");
      break;
    case "HAVE_I_APPLIED_BEFORE":
      toolResults = await haveIAppliedBefore(userId, entityQuery ?? "");
      break;
    case "FIND_CONTACT":
      toolResults = await findContact(userId, entityQuery ?? "");
      break;
    case "PREPARE_FOR_INTERVIEW":
      toolResults = await prepareForInterview(userId, entityQuery ?? "");
      break;
    case "WHY_NOT_HEARING_BACK":
      toolResults = await whyNotHearingBack(userId);
      break;
    default:
      toolResults = {};
  }

  const provider = getAIProvider();
  let reply: string;
  let status: "SUCCESS" | "ERROR" = "SUCCESS";
  let chatUsage;
  try {
    const tracked = await withUsageTracking(() => provider.generateAssistantReply(intent, toolResults));
    reply = tracked.result;
    chatUsage = summarizeUsage(tracked.usage);
  } catch {
    status = "ERROR";
    reply = "Something went wrong answering that. Your data wasn't changed — try again.";
    chatUsage = summarizeUsage([]);
  }

  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: `assistant.${intent}`,
      provider: provider.name,
      providerVersion: provider.version,
      inputRef: parsed.data.message.slice(0, 200),
      outputRef: JSON.stringify(toolResults).slice(0, 500),
      status,
      inputTokens: chatUsage.inputTokens,
      outputTokens: chatUsage.outputTokens,
      estimatedCostUsd: estimateCostUsd(chatUsage.model, chatUsage.inputTokens, chatUsage.outputTokens),
    },
  });

  return NextResponse.json({ reply, intent, toolResults });
}
