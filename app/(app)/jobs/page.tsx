"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { JobImportForm } from "@/components/jobs/JobImportForm";
import { JobFeedCard, type JobFeedItem } from "@/components/jobs/JobFeedCard";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobFeedItem[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/jobs");
    if (!res.ok) return;
    const body = await res.json();
    setJobs(body.jobs ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    load();
  }

  const sorted = jobs
    ? [...jobs].sort((a, b) => (b.score?.overallScore ?? -1) - (a.score?.overallScore ?? -1))
    : null;

  return (
    <div className="px-10 py-11 max-w-[1140px]">
      <SectionHeader
        title="Recommended jobs"
        description="Scored against your profile. Sorted by fit, not by recency — and yes, some of these say don't apply."
      />

      <div className="mt-6">
        <JobImportForm onImported={load} />
      </div>

      <div className="flex flex-col gap-2.5 mt-6">
        {sorted === null ? (
          <div className="text-[13.5px] text-ink-tertiary">Loading…</div>
        ) : sorted.length === 0 ? (
          <Card className="p-6 text-[13.5px] text-ink-tertiary">
            No jobs yet. Paste a posting above to get your first match score.
          </Card>
        ) : (
          sorted.map((job) => <JobFeedCard key={job.id} job={job} onDelete={handleDelete} />)
        )}
      </div>
    </div>
  );
}
