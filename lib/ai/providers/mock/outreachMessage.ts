import type { OutreachMessageRequest, OutreachMessageResult } from "@/lib/ai/types";

/**
 * Every template draws only from contactName/contactRole/relationshipNote (all user-supplied —
 * never an AI-inferred claim about the relationship) and jobTitle/companyName/topMatchedSkills/
 * topRelevantPhrase (the same deterministic facts every other generator uses). Nothing here
 * guesses why this person matters or fabricates a shared history.
 */
export function generateOutreachMessageHeuristic(request: OutreachMessageRequest): OutreachMessageResult {
  const firstName = request.contactName.split(" ")[0];
  const role = request.jobTitle ?? "this role";
  const at = request.companyName ? ` at ${request.companyName}` : "";
  const context = request.relationshipNote ? ` ${request.relationshipNote}` : "";
  const skillClause = request.topMatchedSkills.length > 0 ? ` My background in ${request.topMatchedSkills.join(", ")} lines up with the role.` : "";

  let content: string;
  switch (request.messageType) {
    case "CONNECTION_REQUEST":
      content = `Hi ${firstName}, I'm exploring ${role}${at} and would love to connect.${context}`;
      break;
    case "AFTER_CONNECT":
      content = `Thanks for connecting, ${firstName}! I'm interested in ${role}${at}.${skillClause} Happy to share more if useful.`;
      break;
    case "RECRUITER_MESSAGE":
      content = `Hi ${firstName}, I just applied for ${role}${at} and wanted to reach out directly.${skillClause}`;
      break;
    case "HIRING_MANAGER_MESSAGE":
      content = `Hi ${firstName}, I applied for ${role}${at} and wanted to introduce myself.${skillClause}${
        request.topRelevantPhrase ? ` ${request.topRelevantPhrase}` : ""
      }`;
      break;
    case "REFERRAL_ASK":
      content = `Hi ${firstName},${context} I'm applying for ${role}${at} and would really appreciate a referral if you're comfortable making one.${skillClause}`;
      break;
    case "FOLLOW_UP":
      content = `Hi ${firstName}, following up on my application for ${role}${at} — still very interested and happy to answer any questions.`;
      break;
    default:
      content = `Hi ${firstName}, reaching out about ${role}${at}.`;
  }

  return { content: content.trim(), citedEntityIds: request.citedEntities.map((e) => e.id) };
}
