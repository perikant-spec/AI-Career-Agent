export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

// Buckets by *current* status, not true historical cumulative reach — this app doesn't log
// status-change history, so it can't honestly claim "N applications ever reached Interview"
// once some of those have since moved to Rejected/Withdrawn. Labeling this as current-stage
// counts (not a cumulative funnel) is the accurate claim the data actually supports.
const FUNNEL_GROUPS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: "discovered", label: "Discovered", statuses: ["DISCOVERED"] },
  { key: "shortlisted", label: "Shortlisted / Preparing", statuses: ["SHORTLISTED", "PREPARING", "READY_TO_APPLY"] },
  { key: "applied", label: "Applied", statuses: ["APPLIED", "RECRUITER_CONTACT", "SCREENING"] },
  { key: "interview", label: "Interview", statuses: ["INTERVIEW", "FINAL_INTERVIEW"] },
  { key: "offer", label: "Offer / Accepted", statuses: ["OFFER", "ACCEPTED"] },
];

export function bucketFunnel(statuses: string[]): FunnelStage[] {
  return FUNNEL_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    count: statuses.filter((s) => g.statuses.includes(s)).length,
  }));
}

export function countClosedOut(statuses: string[]): number {
  return statuses.filter((s) => s === "REJECTED" || s === "WITHDRAWN").length;
}
