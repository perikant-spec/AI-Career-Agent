import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { validateCitations } from "@/lib/evidence/validator";
import type { JobRequirements } from "@/lib/ai/types";
import { buildApplicationFacts } from "@/lib/application/facts";
import { daysBetween } from "./dueDate";

const FALLBACK_CONTENT =
  "I couldn't generate a grounded draft here from your verified profile — worth writing this one yourself.";

export interface FollowUpDraft {
  content: string;
  citedEntityIds: string[];
}

/** Same pattern as the resume/cover-letter/outreach generators: deterministic facts, one AI
 *  call, citation-gated, honest fallback on failure. `force` regenerates even if a draft exists. */
export async function ensureFollowUpDraft(userId: string, followUpId: string, force = false): Promise<FollowUpDraft> {
  const followUp = await prisma.followUp.findFirstOrThrow({
    where: { id: followUpId, userId },
    include: { application: { include: { job: true } } },
  });

  if (!force && followUp.draftedMessage) {
    return JSON.parse(followUp.draftedMessage);
  }

  const profileEntries = await prisma.careerProfileEntry.findMany({ where: { userId } });
  const job = followUp.application.job;
  const jobRequirements: JobRequirements = job.parsedRequirements
    ? JSON.parse(job.parsedRequirements)
    : { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [] };
  const facts = buildApplicationFacts(profileEntries, jobRequirements, job.title, job.company);
  const allowedIds = new Set(facts.citedEntities.map((e) => e.id));
  const provider = getAIProvider();

  const appliedAt = followUp.application.appliedAt ?? followUp.createdAt;
  const daysSinceApplied = Math.max(0, daysBetween(appliedAt, new Date()));

  let draft: FollowUpDraft;
  let status: "SUCCESS" | "ERROR" = "SUCCESS";

  try {
    const result = await provider.generateFollowUpMessage({ ...facts, daysSinceApplied });
    const { valid } = validateCitations(result.citedEntityIds, allowedIds);
    draft = valid && result.content.trim()
      ? { content: result.content.trim(), citedEntityIds: result.citedEntityIds }
      : { content: FALLBACK_CONTENT, citedEntityIds: [] };
    if (!valid) status = "ERROR";
  } catch {
    draft = { content: FALLBACK_CONTENT, citedEntityIds: [] };
    status = "ERROR";
  }

  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: "followup.draft",
      provider: provider.name,
      providerVersion: provider.version,
      inputRef: followUpId,
      outputRef: draft.content.slice(0, 200),
      status,
    },
  });

  await prisma.followUp.update({ where: { id: followUpId }, data: { draftedMessage: JSON.stringify(draft) } });

  return draft;
}
