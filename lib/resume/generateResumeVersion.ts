import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { validateCitations } from "@/lib/evidence/validator";
import type { ConfidenceLevel } from "@/lib/types/enums";
import type { JobRequirements } from "@/lib/ai/types";
import { buildDeterministicCustomization, type ChangeLogEntry, type TailoredExperienceEntry, type TailoredSkill } from "./customize";
import { computeAtsScore } from "./atsScore";
import { withUsageTracking, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { validateGeneratedClaims } from "@/lib/evidence/claimValidator";

const USABLE_CONFIDENCE = new Set<ConfidenceLevel>(["VERIFIED", "SUPPORTED_INFERENCE"]);

export interface ResumeVersionContent {
  summary: { original: string; tailored: string };
  skills: TailoredSkill[];
  originalSkillOrder: string[];
  experience: TailoredExperienceEntry[];
  leftOut: string[];
}

export interface PersistedResumeVersion {
  id: string;
  content: ResumeVersionContent;
  changeLog: ChangeLogEntry[];
  atsScoreBefore: number;
  atsScoreAfter: number;
}

/**
 * Orchestrates the resume customizer: deterministic selection/reordering (lib/resume/customize.ts)
 * does the structural work — it's the only thing allowed to decide which entities appear — and
 * the AI provider is asked for exactly one thing, a rephrased summary sentence built from what
 * the deterministic pass already decided was relevant. Its citations are checked against the
 * single entity it was offered before anything from it is kept, exactly like match rationale.
 */
export async function generateResumeVersion(userId: string, jobId: string): Promise<PersistedResumeVersion> {
  const [job, profileEntries] = await Promise.all([
    prisma.job.findFirstOrThrow({ where: { id: jobId, userId } }),
    prisma.careerProfileEntry.findMany({ where: { userId }, orderBy: { orderIndex: "asc" } }),
  ]);

  const jobRequirements: JobRequirements = job.parsedRequirements
    ? JSON.parse(job.parsedRequirements)
    : { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [] };

  const deterministic = buildDeterministicCustomization(profileEntries, jobRequirements);
  const changeLog = [...deterministic.changeLog];

  const summaryEntry = profileEntries.find(
    (e) => e.section === "SUMMARY" && USABLE_CONFIDENCE.has(e.confidence as ConfidenceLevel)
  );
  const originalSummary = summaryEntry?.value ?? "";

  const provider = getAIProvider();
  let tailoredSummary = originalSummary;
  let aiStatus: "SUCCESS" | "ERROR" | "SKIPPED" = "SKIPPED";
  let usage = summarizeUsage([]);

  if (deterministic.topRelevantBullet) {
    const sourceEntry = profileEntries.find((e) => e.id === deterministic.topRelevantBullet!.entryId);
    const citedEntities = sourceEntry
      ? [{ id: sourceEntry.id, label: sourceEntry.label ?? sourceEntry.value, value: sourceEntry.value }]
      : [];
    const allowedIds = new Set(citedEntities.map((e) => e.id));

    try {
      const tracked = await withUsageTracking(() =>
        provider.generateResumeCustomization({
          masterSummary: originalSummary || undefined,
          citedEntities,
          topRelevantPhrase: deterministic.topRelevantBullet!.text,
          jobTitle: job.title ?? undefined,
        })
      );
      usage = summarizeUsage(tracked.usage);
      const result = tracked.result;

      const { valid } = validateCitations(result.citedEntityIds, allowedIds);
      const trimmed = result.tailoredSummary.trim();
      // Citation-id validity proves the model referenced a real entity; it doesn't prove the
      // sentence it wrote stayed within what that entity actually says. This second, independent
      // check catches a fabricated number or skill slipped into an otherwise-valid citation.
      const allowedSourceText = [originalSummary, deterministic.topRelevantBullet.text, job.title ?? ""].join("\n");
      const claimCheck = trimmed ? validateGeneratedClaims(trimmed, allowedSourceText) : { valid: false, unsupportedNumbers: [], unsupportedSkills: [] };

      if (valid && trimmed && claimCheck.valid) {
        tailoredSummary = trimmed;
        changeLog.push({
          kind: "REWORDED",
          text: "Summary now folds in your most relevant experience for this role.",
        });
        aiStatus = "SUCCESS";
      } else {
        aiStatus = "ERROR"; // fabricated/empty — silently keep the original summary, no broken claim reaches the user
      }
    } catch {
      aiStatus = "ERROR";
    }
  }

  // --- ATS before/after, both deterministic ---
  const originalSkills = profileEntries
    .filter((e) => e.section === "SKILL" && USABLE_CONFIDENCE.has(e.confidence as ConfidenceLevel))
    .map((e) => e.value);
  const originalBulletsText = profileEntries
    .filter((e) => e.section === "EXPERIENCE")
    .map((e) => (e.structuredData ? (JSON.parse(e.structuredData).bullets ?? []).join(" ") : ""))
    .join(" ");
  const atsScoreBefore = computeAtsScore(originalSkills, originalBulletsText, jobRequirements);

  const tailoredSkills = deterministic.skills.map((s) => s.value);
  const tailoredBulletsText = deterministic.experience.map((e) => e.bullets.map((b) => b.text).join(" ")).join(" ");
  const atsScoreAfter = computeAtsScore(tailoredSkills, tailoredBulletsText, jobRequirements);

  const content: ResumeVersionContent = {
    summary: { original: originalSummary, tailored: tailoredSummary },
    skills: deterministic.skills,
    originalSkillOrder: originalSkills,
    experience: deterministic.experience,
    leftOut: deterministic.leftOut,
  };

  await prisma.aIInteraction.create({
    data: {
      userId,
      toolName: "resume.customize",
      provider: provider.name,
      providerVersion: provider.version,
      inputRef: jobId,
      outputRef: `ats=${atsScoreBefore}->${atsScoreAfter}`,
      status: aiStatus === "ERROR" ? "ERROR" : "SUCCESS",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
    },
  });

  const saved = await prisma.resumeVersion.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: {
      userId,
      jobId,
      content: JSON.stringify(content),
      changeLog: JSON.stringify(changeLog),
      atsScoreBefore,
      atsScoreAfter,
    },
    update: {
      content: JSON.stringify(content),
      changeLog: JSON.stringify(changeLog),
      atsScoreBefore,
      atsScoreAfter,
    },
  });

  return { id: saved.id, content, changeLog, atsScoreBefore, atsScoreAfter };
}
