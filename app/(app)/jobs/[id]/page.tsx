"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { StaticPill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { CategoryBreakdownBars } from "@/components/jobs/CategoryBreakdownBars";
import { StrengthsGapsColumns } from "@/components/jobs/StrengthsGapsColumns";
import { DisqualifierChecklist } from "@/components/jobs/DisqualifierChecklist";
import { RECOMMENDATION_LABELS, type MatchCategory, type RecommendationTier } from "@/lib/types/enums";

interface JobDetailResponse {
  job: {
    id: string;
    title: string | null;
    company: string | null;
    locationText: string | null;
    rawText: string;
    extractionConfidence: string | null;
  };
  matchScore: {
    overallScore: number;
    categoryScores: Record<MatchCategory, number>;
    strengths: string[];
    gaps: string[];
    disqualifiers: { code: string; reason: string }[];
    recommendationTier: RecommendationTier;
    confidenceNote: string | null;
  } | null;
}

const TIER_TONE: Record<RecommendationTier, "success" | "warning" | "risk"> = {
  APPLY_STRONG: "success",
  APPLY: "success",
  APPLY_IF_INTERESTED: "warning",
  LOW_PRIORITY: "warning",
  DONT_APPLY: "risk",
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [data, setData] = useState<JobDetailResponse | null>(null);
  const [error, setError] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, [id]);

  async function handlePrepareApplication() {
    setPreparing(true);
    setPrepareError(null);
    setUpgradeRequired(false);
    const res = await fetch(`/api/jobs/${id}/apply`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      router.push(`/applications/${body.applicationId}`);
      return;
    }
    const body = await res.json().catch(() => ({}));
    setPrepareError(body.error ?? "Couldn't prepare the application.");
    setUpgradeRequired(Boolean(body.upgradeRequired));
    setPreparing(false);
  }

  if (error) {
    return (
      <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">
        Couldn&apos;t find that job. <Link href="/jobs" className="text-accent-link">Back to jobs</Link>
      </div>
    );
  }
  if (!data) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  const { job, matchScore } = data;

  return (
    <div className="px-10 py-9 max-w-[1140px]">
      <button
        onClick={() => router.push("/jobs")}
        className="text-[12.5px] text-ink-tertiary bg-transparent border-0 cursor-pointer mb-4 p-0"
      >
        ← All recommended jobs
      </button>

      <div className="grid grid-cols-[1fr_320px] gap-5 items-start">
        <div>
          <div className="bg-card border border-border rounded-card p-6">
            <div className="flex gap-5 items-center">
              {matchScore ? (
                <ScoreRing score={matchScore.overallScore} size={96} label="MATCH" />
              ) : (
                <div className="w-24 h-24 flex-none rounded-full bg-black/5 flex items-center justify-center text-[11px] text-ink-quaternary">
                  Scoring…
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-[26px] font-semibold tracking-tight m-0">{job.title ?? "Untitled role"}</h1>
                <div className="text-[14.5px] text-ink-secondary mt-1">
                  {[job.company, job.locationText].filter(Boolean).join(" · ")}
                </div>
                {matchScore ? (
                  <div className="inline-flex items-center gap-2 mt-3">
                    <StaticPill tone={TIER_TONE[matchScore.recommendationTier]}>
                      {RECOMMENDATION_LABELS[matchScore.recommendationTier]}
                    </StaticPill>
                    {matchScore.confidenceNote ? (
                      <span className="text-[12.5px] text-ink-tertiary">{matchScore.confidenceNote}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {matchScore ? (
            <>
              <div className="mt-3.5">
                <CategoryBreakdownBars categoryScores={matchScore.categoryScores} />
              </div>
              <StrengthsGapsColumns strengths={matchScore.strengths} gaps={matchScore.gaps} />
            </>
          ) : null}

          <div className="bg-card border border-border rounded-card p-5 mt-3.5">
            <div className="text-[12.5px] font-semibold mb-2">Original posting text</div>
            <div className="text-[13px] text-ink-secondary whitespace-pre-line max-h-[280px] overflow-y-auto">
              {job.rawText}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="bg-sidebar text-sidebar-text rounded-card p-5">
            <div className="text-[13.5px] font-semibold mb-1.5">Next step</div>
            <div className="text-[13px] text-sidebar-text-dim leading-relaxed">
              Build the full application package from your verified career profile: tailored
              resume, cover letter, and drafted screening answers.
            </div>
            <Button variant="accent" className="w-full mt-3.5" disabled={preparing} onClick={handlePrepareApplication}>
              {preparing ? "Preparing…" : "Prepare application"}
            </Button>
            {prepareError ? (
              <div className="text-[12px] text-sidebar-text-dim mt-2.5">
                {prepareError}{" "}
                {upgradeRequired ? (
                  <Link href="/settings" className="underline text-accent-teal">
                    Upgrade to Pro
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          {matchScore ? <DisqualifierChecklist disqualifiers={matchScore.disqualifiers} /> : null}
        </div>
      </div>
    </div>
  );
}
