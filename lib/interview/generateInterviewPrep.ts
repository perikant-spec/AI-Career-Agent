import { prisma } from "@/lib/prisma";
import type { JobRequirements } from "@/lib/ai/types";
import { buildApplicationFacts } from "@/lib/application/facts";
import { extractCompanyResearch } from "./companyResearch";
import { buildQuestionBank } from "./questionBank";
import { rankExperienceBullets, buildStarAnswer } from "./starAnswers";

const STAR_SHAPED_CATEGORIES = new Set(["BEHAVIORAL", "TECHNICAL", "LEADERSHIP"]);

/**
 * Idempotent — if prep already exists for this application, returns its id untouched. Auto-
 * called the moment an application's status first reaches Interview (or Final Interview), same
 * pattern as the Follow-Up Engine's auto-scheduling.
 */
export async function ensureInterviewPrep(userId: string, applicationId: string): Promise<string> {
  const existing = await prisma.interviewPrep.findUnique({ where: { applicationId } });
  if (existing) return existing.id;

  const application = await prisma.application.findFirstOrThrow({
    where: { id: applicationId, userId },
    include: { job: true },
  });
  const profileEntries = await prisma.careerProfileEntry.findMany({ where: { userId } });
  const jobRequirements: JobRequirements = application.job.parsedRequirements
    ? JSON.parse(application.job.parsedRequirements)
    : { requiredSkills: [], niceToHaveSkills: [], requiredCertifications: [] };

  const companyResearch = extractCompanyResearch(application.job.rawText);
  const rankedBullets = rankExperienceBullets(profileEntries, jobRequirements);
  const motivationFacts = buildApplicationFacts(
    profileEntries,
    jobRequirements,
    application.job.title,
    application.job.company
  );

  const questionBank = buildQuestionBank(
    application.job.title ?? undefined,
    application.job.company ?? undefined,
    jobRequirements.requiredSkills[0]
  );

  const prep = await prisma.interviewPrep.create({
    data: { userId, applicationId, companyResearch: JSON.stringify(companyResearch) },
  });

  let starCursor = 0;
  const rows = questionBank.map((q, index) => {
    if (STAR_SHAPED_CATEGORIES.has(q.category)) {
      const bullet = rankedBullets.length > 0 ? rankedBullets[starCursor % rankedBullets.length] : undefined;
      if (bullet) starCursor += 1;
      const star = buildStarAnswer(bullet);
      return {
        interviewPrepId: prep.id,
        category: q.category,
        question: q.question,
        orderIndex: index,
        starSituation: star.situation,
        starTask: star.task,
        starAction: star.action,
        starResult: star.result,
        citedEntityIds: JSON.stringify(star.citedEntityIds),
      };
    }

    // ROLE_SPECIFIC / COMPANY_FIT — motivation questions, not achievement-shaped, so no S/T/R.
    // Reuses the same deterministic facts cover letters draw from, stored in the Action column.
    const skillsClause =
      motivationFacts.topMatchedSkills.length > 0
        ? `My experience with ${motivationFacts.topMatchedSkills.join(", ")} lines up with what this role needs.`
        : null;
    return {
      interviewPrepId: prep.id,
      category: q.category,
      question: q.question,
      orderIndex: index,
      starSituation: null,
      starTask: null,
      starAction: skillsClause,
      starResult: null,
      citedEntityIds: JSON.stringify(motivationFacts.citedEntities.map((e) => e.id)),
    };
  });

  await prisma.interviewQuestion.createMany({ data: rows });

  return prep.id;
}
