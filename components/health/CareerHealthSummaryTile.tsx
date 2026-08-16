"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreRing } from "@/components/ui/ScoreRing";

// Same duplicated-type convention as CareerHealthSection.tsx — see that file's comment.
interface CareerHealthSummary {
  overallScore: number | null;
  categoriesUsed: number;
  opportunity: { headline: string };
}

/** Compact version of CareerHealthSection for the Assistant home dashboard sidebar — a ring, the
 *  number, and a one-line teaser of the opportunity callout, linking to the full breakdown on
 *  /analytics rather than repeating all six sub-scores in a space this narrow. */
export function CareerHealthSummaryTile() {
  const [summary, setSummary] = useState<CareerHealthSummary | null>(null);

  useEffect(() => {
    fetch("/api/career-health")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => body && setSummary(body.summary));
  }, []);

  if (!summary || summary.categoriesUsed === 0) return null;

  return (
    <div>
      <div className="text-[10.5px] tracking-[0.12em] uppercase text-ink-quaternary mb-2.5">
        Job search health
      </div>
      <Link
        href="/analytics"
        className="flex items-center gap-3 bg-card border border-border rounded-xl p-3.5 hover:border-ink-quaternary transition-colors"
      >
        <ScoreRing score={summary.overallScore ?? 0} size={44} />
        <div className="min-w-0">
          <div className="text-[12.5px] text-ink-secondary leading-snug line-clamp-2">
            {summary.opportunity.headline}
          </div>
          <div className="text-[11px] text-ink-quaternary mt-0.5">View breakdown →</div>
        </div>
      </Link>
    </div>
  );
}
