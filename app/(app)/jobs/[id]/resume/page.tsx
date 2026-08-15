"use client";

import { useEffect, useState, use as usePromise, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AtsScoreTiles } from "@/components/resume/AtsScoreTiles";
import { ResumeComparisonPanel } from "@/components/resume/ResumeComparisonPanel";
import { ChangeLogPanel } from "@/components/resume/ChangeLogPanel";
import { LeftOutCallout } from "@/components/resume/LeftOutCallout";
import type { ResumeVersionContent } from "@/lib/resume/generateResumeVersion";
import type { ChangeLogEntry } from "@/lib/resume/customize";

interface ResumeVersionResponse {
  content: ResumeVersionContent;
  changeLog: ChangeLogEntry[];
  atsScoreBefore: number;
  atsScoreAfter: number;
}

export default function CustomizedResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [job, setJob] = useState<{ title: string | null; company: string | null } | null>(null);
  const [version, setVersion] = useState<ResumeVersionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [jobRes, versionRes] = await Promise.all([
      fetch(`/api/jobs/${id}`),
      fetch(`/api/jobs/${id}/resume-version`),
    ]);
    if (jobRes.ok) {
      const body = await jobRes.json();
      setJob({ title: body.job.title, company: body.job.company });
    }
    if (versionRes.ok) {
      const body = await versionRes.json();
      setVersion(body.resumeVersion);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/jobs/${id}/resume-version`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't generate a tailored resume for this job.");
      setGenerating(false);
      return;
    }
    const body = await res.json();
    setVersion(body.resumeVersion);
    setGenerating(false);
  }

  if (loading) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  return (
    <div className="px-10 py-9 max-w-[1180px]">
      <Link href={`/jobs/${id}`} className="text-[12.5px] text-ink-tertiary block mb-4 no-underline">
        ← Back to match score
      </Link>

      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-wide text-ink-quaternary uppercase">
            {version ? "Tailored resume" : "Resume customization"}
          </div>
          <h1 className="font-serif text-[34px] font-normal mt-1.5">
            {job?.company ? `Customized for ${job.company}` : "Customized resume"}
          </h1>
          <p className="text-[14.5px] text-ink-secondary mt-1.5 max-w-[620px]">
            Reordered and rephrased from your master resume. Nothing new was authored — the
            customizer can only move and reword what already exists.
          </p>
        </div>
        {version ? <AtsScoreTiles before={version.atsScoreBefore} after={version.atsScoreAfter} /> : null}
      </div>

      {error ? (
        <div className="mt-4 text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2">
          {error}
        </div>
      ) : null}

      {!version ? (
        <div className="bg-card border border-border rounded-card p-8 mt-6 text-center">
          <div className="text-[14px] text-ink-secondary mb-3.5">
            No tailored resume for this job yet — generate one from your verified career profile.
          </div>
          <Button variant="primary" disabled={generating} onClick={handleGenerate}>
            {generating ? "Generating…" : "Generate tailored resume"}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_280px] gap-3.5 mt-6 items-start">
            <ResumeComparisonPanel content={version.content} companyName={job?.company} />
            <div className="flex flex-col gap-3">
              <ChangeLogPanel changeLog={version.changeLog} />
              <LeftOutCallout leftOut={version.content.leftOut} />
              <Button variant="secondary" disabled={generating} onClick={handleGenerate}>
                {generating ? "Regenerating…" : "Regenerate"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
