"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";

interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

interface AnalyticsSummary {
  totalApplications: number;
  funnel: FunnelStage[];
  closedOut: number;
  avgMatchScore: number | null;
  matchScoreSampleSize: number;
  avgAtsScore: number | null;
  atsScoreSampleSize: number;
  avgDaysToApply: number | null;
  daysToApplySampleSize: number;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => body && setSummary(body.summary));
  }, []);

  if (!summary) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  const maxCount = Math.max(1, ...summary.funnel.map((f) => f.count));

  return (
    <div className="px-10 py-11 max-w-[1000px]">
      <SectionHeader
        title="Analytics"
        description={
          summary.totalApplications === 0
            ? "Your funnel, and where it leaks — once there's a funnel to measure."
            : `Your funnel, and where it leaks. Based on ${summary.totalApplications} application${summary.totalApplications === 1 ? "" : "s"} — small numbers stay labelled as small, not dressed up as a trend.`
        }
      />

      {summary.totalApplications === 0 ? (
        <Card className="p-6 mt-7 text-[13.5px] text-ink-tertiary">
          No applications yet. Once you&apos;ve scored a few jobs and moved some through the
          tracker, your funnel and averages will show up here.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mt-7">
            <StatTile
              value={summary.avgMatchScore ?? "—"}
              label="Avg. match score"
              note={summary.matchScoreSampleSize > 0 ? `n=${summary.matchScoreSampleSize}` : "no scored jobs yet"}
            />
            <StatTile
              value={summary.avgAtsScore ?? "—"}
              label="Avg. ATS score"
              note={summary.atsScoreSampleSize > 0 ? `n=${summary.atsScoreSampleSize}` : "no tailored resumes yet"}
            />
            <StatTile
              value={summary.avgDaysToApply ?? "—"}
              label="Avg. days to apply"
              note={summary.daysToApplySampleSize > 0 ? `n=${summary.daysToApplySampleSize}` : "no applications sent yet"}
            />
            <StatTile value={summary.closedOut} label="Rejected / withdrawn" />
          </div>

          <Card className="p-[22px] mt-4">
            <div className="flex justify-between items-baseline mb-4">
              <div className="text-[14px] font-semibold">Funnel</div>
              <div className="text-[11px] text-ink-quaternary font-mono">
                CURRENT STAGE OF EACH APPLICATION
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {summary.funnel.map((f) => (
                <div key={f.key} className="grid grid-cols-[160px_1fr_44px] gap-3.5 items-center">
                  <div className="text-[13px] text-ink-primary">{f.label}</div>
                  <div className="h-[24px] bg-black/[0.05] rounded-md overflow-hidden">
                    <div
                      className="h-full bg-accent-teal flex items-center pl-2.5 font-mono text-[11px] text-accent-teal-ink"
                      style={{ width: `${Math.max(6, (f.count / maxCount) * 100)}%` }}
                    >
                      {f.count > 0 ? f.count : ""}
                    </div>
                  </div>
                  <div className="font-mono text-[12.5px] text-right">{f.count}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-ink-quaternary mt-3.5 leading-relaxed">
              Counts reflect each application&apos;s current status, not historical reach — this
              app doesn&apos;t log status-change history, so it can&apos;t claim how many
              applications ever passed through a stage before moving on or closing out.
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
