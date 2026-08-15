import type { ApplicationGenerationFacts, CoverLetterResult } from "@/lib/ai/types";

/**
 * Deliberately plain rather than persuasive-sounding — every sentence traces to
 * topMatchedSkills/topRelevantPhrase, never to invented enthusiasm ("passionate about your
 * mission") that can't be grounded in anything the profile actually says.
 */
export function generateCoverLetterHeuristic(facts: ApplicationGenerationFacts): CoverLetterResult {
  const role = facts.jobTitle ?? "this role";
  const at = facts.companyName ? ` at ${facts.companyName}` : "";
  const greeting = facts.companyName ? `Dear ${facts.companyName} Hiring Team,` : "Dear Hiring Team,";

  const skillsSentence =
    facts.topMatchedSkills.length > 0
      ? `My experience with ${facts.topMatchedSkills.join(", ")} lines up directly with what this role asks for.`
      : "";
  const achievementSentence = facts.topRelevantPhrase
    ? ` ${facts.topRelevantPhrase.replace(/\.$/, "")}.`
    : "";

  const content = [
    greeting,
    "",
    `I'm writing to apply for ${role}${at}. ${skillsSentence}${achievementSentence}`.trim(),
    "",
    "I'd welcome the chance to discuss how my background fits your team's needs.",
    "",
    "Sincerely,",
  ].join("\n");

  return { content, citedEntityIds: facts.citedEntities.map((e) => e.id) };
}
