// A fixed, generic question set — Phase 1 doesn't parse employer-specific screening questions
// off a posting (that's out of scope here), so these three cover what's genuinely common across
// applications and can be answered honestly from verified/inferred evidence alone.
export const DEFAULT_APPLICATION_QUESTIONS = [
  "Why are you interested in this role?",
  "What relevant experience do you bring to this position?",
  "What is your greatest strength for this role?",
] as const;
