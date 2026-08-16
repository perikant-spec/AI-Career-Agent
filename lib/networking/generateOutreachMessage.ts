import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { validateCitations } from "@/lib/evidence/validator";
import type { JobRequirements } from "@/lib/ai/types";
import type { OutreachMessageType } from "@/lib/types/enums";
import { buildApplicationFacts } from "@/lib/application/facts";
import { withUsageTracking, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { validateGeneratedClaims, allowedSourceTextFromFacts } from "@/lib/evidence/claimValidator";

const FALLBACK_CONTENT =
  "I couldn't generate a grounded draft here from your verified profile — worth writing this one yourself.";

export interface PersistedOutreachMessage {
  id: string;
  messageType: string;
  content: string;
  citedEntityIds: string[];
  status: string;
  sentAt: Date | null;
}

/**
 * Generates (or, with force, regenerates) exactly one message slot for a contact — the unique
 * constraint on (contactId, messageType) means there's always at most one current draft per
 * type, same "regenerate replaces the canonical draft" pattern as the resume/cover-letter
 * generators. Grounded in the same deterministic facts (lib/application/facts.ts) plus the
 * contact's own user-supplied details; gated by the same citation check as everything else.
 */
export async function ensureOutreachMessage(
  userId: string,
  contactId: string,
  messageType: OutreachMessageType,
  force = false
): Promise<PersistedOutreachMessage> {
  const contact = await prisma.contact.findFirstOrThrow({
    where: { id: contactId, userId },
    include: { job: true },
  });

  if (!force) {
    const existing = await prisma.outreachMessage.findUnique({
      where: { contactId_messageType: { contactId, messageType } },
    });
    if (existing) {
      return {
        id: existing.id,
        messageType: existing.messageType,
        content: existing.content,
        citedEntityIds: JSON.parse(existing.citedEntityIds),
        status: existing.status,
        sentAt: existing.sentAt,
      };
    }
  }

  const profileEntries = await prisma.careerProfileEntry.findMany({ where: { userId } });
  const jobRequirements: JobRequirements = contact.job.parsedRequirements
    ? JSON.parse(contact.job.parsedRequirements)
    : { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [] };
  const facts = buildApplicationFacts(profileEntries, jobRequirements, contact.job.title, contact.job.company);
  const allowedIds = new Set(facts.citedEntities.map((e) => e.id));
  const allowedSourceText = allowedSourceTextFromFacts(facts, [contact.name, contact.role ?? undefined, contact.relationshipNote ?? undefined]);
  const provider = getAIProvider();

  let content: string;
  let citedEntityIds: string[];
  let status: "SUCCESS" | "ERROR" = "SUCCESS";
  let usage = summarizeUsage([]);

  try {
    const tracked = await withUsageTracking(() =>
      provider.generateOutreachMessage({
        ...facts,
        contactName: contact.name,
        contactRole: contact.role ?? undefined,
        messageType,
        relationshipNote: contact.relationshipNote ?? undefined,
      })
    );
    usage = summarizeUsage(tracked.usage);
    const result = tracked.result;
    const { valid } = validateCitations(result.citedEntityIds, allowedIds);
    const claimCheck = valid ? validateGeneratedClaims(result.content, allowedSourceText) : { valid: false, unsupportedNumbers: [], unsupportedSkills: [] };
    if (valid && claimCheck.valid && result.content.trim()) {
      content = result.content.trim();
      citedEntityIds = result.citedEntityIds;
    } else {
      content = FALLBACK_CONTENT;
      citedEntityIds = [];
      status = "ERROR";
    }
  } catch {
    content = FALLBACK_CONTENT;
    citedEntityIds = [];
    status = "ERROR";
  }

  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: "networking.outreachMessage",
      provider: provider.name,
      providerVersion: provider.version,
      inputRef: `${contactId}:${messageType}`,
      outputRef: content.slice(0, 200),
      status,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
    },
  });

  const saved = await prisma.outreachMessage.upsert({
    where: { contactId_messageType: { contactId, messageType } },
    create: { userId, contactId, messageType, content, citedEntityIds: JSON.stringify(citedEntityIds) },
    update: { content, citedEntityIds: JSON.stringify(citedEntityIds), status: "DRAFT", sentAt: null },
  });

  return {
    id: saved.id,
    messageType: saved.messageType,
    content: saved.content,
    citedEntityIds,
    status: saved.status,
    sentAt: saved.sentAt,
  };
}
