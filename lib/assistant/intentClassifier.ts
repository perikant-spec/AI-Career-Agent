export const INTENTS = [
  "WHAT_SHOULD_I_APPLY_TODAY",
  "EXPLAIN_JOB_SCORE",
  "CUSTOMIZE_RESUME",
  "HAVE_I_APPLIED_BEFORE",
  "FIND_CONTACT",
  "PREPARE_FOR_INTERVIEW",
  "WHY_NOT_HEARING_BACK",
  "GENERAL_FALLBACK",
] as const;
export type Intent = (typeof INTENTS)[number];

export interface ClassifiedIntent {
  intent: Intent;
  /** Free-text company/title fragment for intents that need to look up a specific job. */
  entityQuery?: string;
}

function extractEntity(message: string): string {
  const m = message.match(/(?:for|at|to)\s+([A-Za-z0-9&.,'-][A-Za-z0-9&.,'\- ]{1,60})/i);
  return (m ? m[1] : message).trim().replace(/[?.!]+$/, "");
}

/**
 * Heuristic, keyword/regex based — each branch maps to exactly one scoped backend tool (see
 * lib/assistant/intents/*), never a free-form generation. This keeps every assistant reply
 * traceable to a real tool-call result instead of the model inventing an answer.
 */
export function classifyIntent(message: string): ClassifiedIntent {
  const m = message.trim();

  if (/what should i apply|what to apply|what.*apply.*today/i.test(m)) {
    return { intent: "WHAT_SHOULD_I_APPLY_TODAY" };
  }

  if (/why (was|is|did|were).*(don'?t apply|marked|scored)|explain.*(score|match)/i.test(m)) {
    return { intent: "EXPLAIN_JOB_SCORE", entityQuery: extractEntity(m) };
  }

  if (/prepare.*(for|me).*interview|interview prep/i.test(m)) {
    return { intent: "PREPARE_FOR_INTERVIEW", entityQuery: extractEntity(m) };
  }

  if (/(customize|tailor).*resume|resume.*(customize|tailor)|prepare.*application|prepare.*apply/i.test(m)) {
    return { intent: "CUSTOMIZE_RESUME", entityQuery: extractEntity(m) };
  }

  if (/applied to.*before|have i applied|already applied/i.test(m)) {
    return { intent: "HAVE_I_APPLIED_BEFORE", entityQuery: extractEntity(m) };
  }

  if (/find.*(hiring manager|recruiter|contact)|who (should|do) i (contact|reach)/i.test(m)) {
    return { intent: "FIND_CONTACT", entityQuery: extractEntity(m) };
  }

  if (/why.*(not|n'?t).*(hear|hearing|interview|response|call ?back)/i.test(m)) {
    return { intent: "WHY_NOT_HEARING_BACK" };
  }

  return { intent: "GENERAL_FALLBACK" };
}
