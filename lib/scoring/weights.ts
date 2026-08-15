import type { MatchCategory } from "@/lib/types/enums";

// Skills/Experience/Seniority weighted highest — the PRD calls these the "harder gates" of the
// eight categories. Configurable by design (not hard-coded into the scorer itself) so a later
// phase can expose per-user weight tuning without touching scoring logic.
export const CATEGORY_WEIGHTS: Record<MatchCategory, number> = {
  skills: 0.25,
  experience: 0.2,
  seniority: 0.15,
  industry: 0.1,
  location: 0.1,
  compensation: 0.08,
  educationCertification: 0.07,
  careerTrajectory: 0.05,
};
