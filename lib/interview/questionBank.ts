import type { InterviewQuestionCategory } from "@/lib/types/enums";

export interface QuestionSlot {
  category: InterviewQuestionCategory;
  question: string;
}

/**
 * Standard interview question templates — generic prompts, not claims about the candidate, so
 * no evidence grounding applies to the questions themselves (only to their answers). A couple
 * are lightly parameterized by job/company/topSkill so they read as posting-specific.
 */
export function buildQuestionBank(jobTitle?: string, companyName?: string, topSkill?: string): QuestionSlot[] {
  const role = jobTitle ?? "this role";
  const at = companyName ? ` at ${companyName}` : "";
  const skill = topSkill ?? "a skill relevant to this role";

  return [
    { category: "BEHAVIORAL", question: "Tell me about a time you faced a significant challenge at work and how you handled it." },
    { category: "BEHAVIORAL", question: "Describe a time you had to work with a difficult stakeholder or teammate." },
    { category: "TECHNICAL", question: `Walk me through your experience with ${skill}.` },
    { category: "TECHNICAL", question: "Describe a technical or process decision you made that you'd reconsider today." },
    { category: "ROLE_SPECIFIC", question: `Why are you interested in ${role}${at}?` },
    { category: "ROLE_SPECIFIC", question: "What do you think are the biggest challenges in a role like this?" },
    { category: "LEADERSHIP", question: "Tell me about a time you led a project or initiative." },
    { category: "LEADERSHIP", question: "How do you handle disagreement within a team you're part of?" },
    { category: "COMPANY_FIT", question: `What interests you about${at || " this opportunity"}?` },
    { category: "COMPANY_FIT", question: "Where do you see yourself growing in this role?" },
  ];
}
