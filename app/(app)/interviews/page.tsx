"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { StaticPill } from "@/components/ui/Pill";
import { APPLICATION_STATUS_LABELS } from "@/lib/types/enums";

interface ApplicationSummary {
  id: string;
  status: string;
  company: string | null;
  title: string | null;
  score: number | null;
}

export default function InterviewsPage() {
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/applications");
    if (!res.ok) return;
    const body = await res.json();
    setApplications(
      (body.applications ?? []).filter((a: ApplicationSummary) =>
        ["INTERVIEW", "FINAL_INTERVIEW"].includes(a.status)
      )
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-10 py-11 max-w-[900px]">
      <SectionHeader
        title="Interview preparation"
        description="Built automatically the moment an application moves to Interview: company research, likely questions, and STAR answers from your verified evidence — nothing invented."
      />

      <div className="flex flex-col gap-2.5 mt-7">
        {applications === null ? (
          <div className="text-[13.5px] text-ink-tertiary">Loading…</div>
        ) : applications.length === 0 ? (
          <Card className="p-6 text-[13.5px] text-ink-tertiary">
            No applications at Interview stage yet. Prep is built automatically once you move one
            there from the tracker.
          </Card>
        ) : (
          applications.map((a) => (
            <Link key={a.id} href={`/interviews/${a.id}`} className="no-underline">
              <Card className="p-4.5 flex items-center gap-4 hover:border-ink-quaternary">
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold">{a.company ?? "Unknown company"}</div>
                  <div className="text-[12.5px] text-ink-tertiary mt-0.5">{a.title ?? "Untitled role"}</div>
                </div>
                {a.score !== null ? <span className="font-mono text-[13px] text-ink-tertiary">{a.score}</span> : null}
                <StaticPill>{APPLICATION_STATUS_LABELS[a.status as keyof typeof APPLICATION_STATUS_LABELS] ?? a.status}</StaticPill>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
