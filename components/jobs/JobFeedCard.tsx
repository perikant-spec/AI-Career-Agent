import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { StaticPill } from "@/components/ui/Pill";
import { RECOMMENDATION_LABELS, type RecommendationTier } from "@/lib/types/enums";

const TIER_TONE: Record<RecommendationTier, "success" | "warning" | "risk" | "default"> = {
  APPLY_STRONG: "success",
  APPLY: "success",
  APPLY_IF_INTERESTED: "warning",
  LOW_PRIORITY: "warning",
  DONT_APPLY: "risk",
};

export interface JobFeedItem {
  id: string;
  title: string | null;
  company: string | null;
  locationText: string | null;
  score: { overallScore: number; recommendationTier: RecommendationTier } | null;
}

export function JobFeedCard({ job, onDelete }: { job: JobFeedItem; onDelete: (id: string) => void }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      {job.score ? (
        <ScoreRing score={job.score.overallScore} size={52} />
      ) : (
        <div className="w-[52px] h-[52px] flex-none rounded-full bg-black/5 flex items-center justify-center text-[10px] text-ink-quaternary">
          n/a
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-semibold">{job.title ?? "Untitled role"}</span>
          {job.company ? <span className="text-[13px] text-ink-secondary">{job.company}</span> : null}
          {job.score ? (
            <StaticPill tone={TIER_TONE[job.score.recommendationTier]}>
              {RECOMMENDATION_LABELS[job.score.recommendationTier]}
            </StaticPill>
          ) : null}
        </div>
        {job.locationText ? <div className="text-[12px] text-ink-tertiary mt-1">{job.locationText}</div> : null}
      </div>
      <div className="flex flex-col gap-1.5 flex-none">
        <Link href={`/jobs/${job.id}`}>
          <div className="rounded-btn bg-sidebar text-sidebar-text px-3.5 py-1.5 text-[12.5px] text-center cursor-pointer">
            View
          </div>
        </Link>
        <button
          onClick={() => onDelete(job.id)}
          className="text-[11.5px] text-ink-tertiary hover:text-accent-risk-text bg-transparent border-0 cursor-pointer"
        >
          Remove
        </button>
      </div>
    </Card>
  );
}
