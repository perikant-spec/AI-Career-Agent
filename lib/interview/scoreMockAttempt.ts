import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { withUsageTracking, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";

export interface MockAttemptScores {
  id: string;
  responseText: string;
  scoreRelevance: number;
  scoreClarity: number;
  scoreStructure: number;
  scoreCompleteness: number;
  feedback: string;
}

/** No citation-validation gate here — unlike every other generator in this app, this doesn't
 *  produce a claim about the candidate that needs grounding in their profile. It's scoring the
 *  user's own freshly-typed text against the question, so there's nothing to fabricate. */
export async function scoreMockAttempt(
  userId: string,
  interviewQuestionId: string,
  responseText: string
): Promise<MockAttemptScores> {
  const question = await prisma.interviewQuestion.findFirstOrThrow({
    where: { id: interviewQuestionId, interviewPrep: { userId } },
  });

  const provider = getAIProvider();
  let status: "SUCCESS" | "ERROR" = "SUCCESS";
  let scores: Omit<MockAttemptScores, "id" | "responseText">;
  let usage = summarizeUsage([]);

  try {
    const tracked = await withUsageTracking(() =>
      provider.scoreMockInterviewResponse({ question: question.question, responseText })
    );
    usage = summarizeUsage(tracked.usage);
    scores = tracked.result;
  } catch {
    status = "ERROR";
    scores = {
      scoreRelevance: 0,
      scoreClarity: 0,
      scoreStructure: 0,
      scoreCompleteness: 0,
      feedback: "Couldn't score this response — try again.",
    };
  }

  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: "interview.mockScore",
      provider: provider.name,
      providerVersion: provider.version,
      inputRef: interviewQuestionId,
      outputRef: `relevance=${scores.scoreRelevance}`,
      status,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
    },
  });

  const attempt = await prisma.mockInterviewAttempt.create({
    data: { userId, interviewQuestionId, responseText, ...scores },
  });

  return { id: attempt.id, responseText: attempt.responseText, ...scores };
}
