import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { validateCitations } from "@/lib/evidence/validator";
import type { JobRequirements, ApplicationAnswerItem } from "@/lib/ai/types";
import { buildApplicationFacts } from "./facts";
import { DEFAULT_APPLICATION_QUESTIONS } from "./questions";
import { generateResumeVersion } from "@/lib/resume/generateResumeVersion";
import { withUsageTracking, summarizeUsage } from "@/lib/ai/usageTracking";
import { estimateCostUsd } from "@/lib/ai/pricing";

const FALLBACK_ANSWER =
  "I couldn't generate a grounded answer here from your verified profile — worth writing this one yourself.";

export interface CoverLetterContent {
  content: string;
  citedEntityIds: string[];
}

export interface ApplicationPackageOptions {
  forceResume?: boolean;
  forceCoverLetter?: boolean;
  forceQa?: boolean;
}

/**
 * Ensures an Application row exists and has a resume version, cover letter, and Q&A answers —
 * generating whichever pieces are missing (or forced) and leaving the rest untouched. Every
 * generated piece is grounded in lib/application/facts.ts and gated by the same citation check
 * used everywhere else in the pipeline; a piece that fails validation gets a visible, honest
 * fallback rather than being silently dropped or upgraded.
 */
export async function ensureApplicationPackage(
  userId: string,
  jobId: string,
  options: ApplicationPackageOptions = {}
) {
  const job = await prisma.job.findFirstOrThrow({ where: { id: jobId, userId } });

  let application = await prisma.application.findUnique({ where: { userId_jobId: { userId, jobId } } });
  if (!application) {
    application = await prisma.application.create({ data: { userId, jobId } });
  }
  if (application.status === "DISCOVERED" || application.status === "SHORTLISTED") {
    application = await prisma.application.update({ where: { id: application.id }, data: { status: "PREPARING" } });
  }

  if (options.forceResume || !(await prisma.resumeVersion.findUnique({ where: { userId_jobId: { userId, jobId } } }))) {
    await generateResumeVersion(userId, jobId);
  }

  const needsCoverLetter = options.forceCoverLetter || !application.coverLetterContent;
  const needsQa = options.forceQa || !application.qaAnswers;

  if (needsCoverLetter || needsQa) {
    const profileEntries = await prisma.careerProfileEntry.findMany({ where: { userId } });
    const jobRequirements: JobRequirements = job.parsedRequirements
      ? JSON.parse(job.parsedRequirements)
      : { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [] };
    const facts = buildApplicationFacts(profileEntries, jobRequirements, job.title, job.company);
    const allowedIds = new Set(facts.citedEntities.map((e) => e.id));
    const provider = getAIProvider();

    const updateData: { coverLetterContent?: string; qaAnswers?: string } = {};

    if (needsCoverLetter) {
      let status: "SUCCESS" | "ERROR" = "SUCCESS";
      let coverLetter: CoverLetterContent;
      let coverLetterUsage = summarizeUsage([]);
      try {
        const tracked = await withUsageTracking(() => provider.generateCoverLetter(facts));
        coverLetterUsage = summarizeUsage(tracked.usage);
        const result = tracked.result;
        const { valid } = validateCitations(result.citedEntityIds, allowedIds);
        coverLetter = valid
          ? { content: result.content, citedEntityIds: result.citedEntityIds }
          : { content: FALLBACK_ANSWER, citedEntityIds: [] };
        if (!valid) status = "ERROR";
      } catch {
        status = "ERROR";
        coverLetter = { content: FALLBACK_ANSWER, citedEntityIds: [] };
      }
      updateData.coverLetterContent = JSON.stringify(coverLetter);
      await prisma.aIInteraction.create({
        data: {
          userId,
          toolName: "application.coverLetter",
          provider: provider.name,
          providerVersion: provider.version,
          inputRef: jobId,
          outputRef: coverLetter.content.slice(0, 200),
          status,
          inputTokens: coverLetterUsage.inputTokens,
          outputTokens: coverLetterUsage.outputTokens,
          estimatedCostUsd: estimateCostUsd(coverLetterUsage.model, coverLetterUsage.inputTokens, coverLetterUsage.outputTokens),
        },
      });
    }

    if (needsQa) {
      let status: "SUCCESS" | "ERROR" = "SUCCESS";
      let answers: ApplicationAnswerItem[];
      let qaUsage = summarizeUsage([]);
      try {
        const tracked = await withUsageTracking(() =>
          provider.generateApplicationAnswers({ ...facts, questions: [...DEFAULT_APPLICATION_QUESTIONS] })
        );
        qaUsage = summarizeUsage(tracked.usage);
        const result = tracked.result;
        answers = result.answers.map((a) => {
          const { valid } = validateCitations(a.citedEntityIds, allowedIds);
          if (!valid) status = "ERROR";
          return valid ? a : { question: a.question, answer: FALLBACK_ANSWER, citedEntityIds: [] };
        });
        if (answers.length !== DEFAULT_APPLICATION_QUESTIONS.length) {
          status = "ERROR";
        }
      } catch {
        status = "ERROR";
        answers = DEFAULT_APPLICATION_QUESTIONS.map((question) => ({
          question,
          answer: FALLBACK_ANSWER,
          citedEntityIds: [],
        }));
      }
      updateData.qaAnswers = JSON.stringify(answers);
      await prisma.aIInteraction.create({
        data: {
          userId,
          toolName: "application.qaAnswers",
          provider: provider.name,
          providerVersion: provider.version,
          inputRef: jobId,
          outputRef: `answers=${answers.length}`,
          status,
          inputTokens: qaUsage.inputTokens,
          outputTokens: qaUsage.outputTokens,
          estimatedCostUsd: estimateCostUsd(qaUsage.model, qaUsage.inputTokens, qaUsage.outputTokens),
        },
      });
    }

    application = await prisma.application.update({ where: { id: application.id }, data: updateData });
  }

  return application;
}
