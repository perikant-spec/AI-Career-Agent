import type { ApplicationAnswersRequest, ApplicationAnswersResult } from "@/lib/ai/types";

function answerFor(question: string, facts: ApplicationAnswersRequest): string {
  const q = question.toLowerCase();
  const role = facts.jobTitle ?? "this role";
  const at = facts.companyName ? ` at ${facts.companyName}` : "";
  const skills = facts.topMatchedSkills.join(", ");

  if (q.includes("interested") || q.startsWith("why")) {
    return skills
      ? `I'm interested in ${role}${at} because it lines up with my experience in ${skills}.`
      : `I'm interested in ${role}${at} based on my background in this area.`;
  }
  if (q.includes("experience")) {
    return facts.topRelevantPhrase
      ? facts.topRelevantPhrase
      : skills
        ? `My relevant experience includes ${skills}.`
        : "My relevant experience is detailed in my resume.";
  }
  if (q.includes("strength")) {
    return facts.topMatchedSkills[0]
      ? `My strongest fit for this role is ${facts.topMatchedSkills[0]}, which I've applied directly in my past work.`
      : "My strongest fit for this role is reflected in my verified work history.";
  }
  return facts.topRelevantPhrase ?? "Grounded in my verified experience — see my resume for detail.";
}

/** Same grounding rule as the cover letter: every answer only draws on topMatchedSkills /
 *  topRelevantPhrase / jobTitle / companyName, never invents a claim beyond those. */
export function generateApplicationAnswersHeuristic(request: ApplicationAnswersRequest): ApplicationAnswersResult {
  const citedEntityIds = request.citedEntities.map((e) => e.id);
  return {
    answers: request.questions.map((question) => ({
      question,
      answer: answerFor(question, request),
      citedEntityIds,
    })),
  };
}
