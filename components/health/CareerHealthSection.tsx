"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SubScoreBar } from "./SubScoreBar";

// Duplicated from lib/health/computeCareerHealth.ts rather than imported — same convention
// app/(app)/analytics/page.tsx already uses for AnalyticsSummary, keeping server-only modules
// (this one imports Prisma) out of what a client component pulls types from.
interface CareerHealthCategorySummary {
  key: string;
  label: string;
  score: number;
  sampleSize: number;
}

interface OpportunityInsight {
  kind: "opportunity" | "positive" | "onboarding";
  categoryKey: string | null;
  headline: string;
  detail: string;
}

interface CareerHealthSummary {
  overallScore: number | null;
  categoriesUsed: number;
  categories: CareerHealthCategorySummary[];
  opportunity: OpportunityInsight;
}

// text-ink-primary for the warning tone, not accent-warning-text — that token doesn't exist in
// tailwind.config.ts (only `warning`/`warning-bg`/`warning-border` are defined), same pattern
// every other warning-toned surface in this app already follows (e.g.
// components/resumes/LowConfidenceCallout.tsx).
const OPPORTUNITY_TONE: Record<OpportunityInsight["kind"], string> = {
  opportunity: "border-accent-warning-border bg-accent-warning-bg text-ink-primary",
  positive: "border-accent-success-border bg-accent-success-bg text-accent-success-text",
  onboarding: "border-border bg-black/[0.02] text-ink-secondary",
};

export function CareerHealthSection() {
  const [summary, setSummary] = useState<CareerHealthSummary | null>(null);

  useEffect(() => {
    fetch("/api/career-health")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => body && setSummary(body.summary));
  }, []);

  if (!summary) {
    return (
      <Card className="p-[22px]">
        <div className="text-[13.5px] text-ink-tertiary">Loading your health score…</div>
      </Card>
    );
  }

  const totalCategories = summary.categories.length;

  return (
    <Card className="p-[22px]">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px] font-semibold">Your Job Search Health</div>
        {summary.categoriesUsed < totalCategories ? (
          <div className="text-[11px] text-ink-quaternary font-mono">
            BASED ON {summary.categoriesUsed} OF {totalCategories} AREAS
          </div>
        ) : null}
      </div>

      <div className="flex gap-6 items-start mt-4">
        <ScoreRing score={summary.overallScore ?? 0} size={92} />

        <div className="flex-1 min-w-0 flex flex-col gap-2.5 pt-1">
          {summary.categories.map((c) => (
            <SubScoreBar key={c.key} label={c.label} score={c.score} sampleSize={c.sampleSize} />
          ))}
        </div>
      </div>

      <div className={`mt-5 rounded-btn border px-4 py-3.5 ${OPPORTUNITY_TONE[summary.opportunity.kind]}`}>
        <div className="text-[13.5px] font-semibold">{summary.opportunity.headline}</div>
        <div className="text-[12.5px] mt-1 leading-relaxed opacity-90">{summary.opportunity.detail}</div>
      </div>
    </Card>
  );
}
