import type { ApplicationStatus } from "@/lib/types/enums";

export interface ApplicationTrackerItem {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  title: string | null;
  company: string | null;
  score: number | null;
  recommendationTier: string | null;
  notes: string | null;
  updatedAt: string;
  appliedAt: string | null;
}
