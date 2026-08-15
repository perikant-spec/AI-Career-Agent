"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { relativeDueLabel, type FollowUpListItem } from "./types";

export function FollowUpQueue() {
  const [followUps, setFollowUps] = useState<FollowUpListItem[] | null>(null);

  useEffect(() => {
    fetch("/api/follow-ups")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body) return;
        const pending: FollowUpListItem[] = body.followUps.filter((f: FollowUpListItem) => f.status === "PENDING");
        setFollowUps(pending);
      });
  }, []);

  const items = (followUps ?? []).slice(0, 3);

  if (followUps !== null && items.length === 0) return null;

  return (
    <div>
      <div className="text-[10.5px] tracking-[0.12em] uppercase text-ink-quaternary mb-2.5">
        Today&apos;s queue
      </div>
      <div className="flex flex-col gap-2">
        {items.map((f) => (
          <Link key={f.id} href={`/applications/${f.applicationId}`} className="no-underline">
            <div className="bg-card border border-border rounded-xl px-3.5 py-3 hover:border-ink-quaternary">
              <div
                className="font-mono text-[10.5px] tracking-wide"
                style={{ color: f.isDue ? "oklch(0.55 0.14 30)" : "#8C877A" }}
              >
                FOLLOW-UP
              </div>
              <div className="text-[13.5px] font-semibold mt-1">{f.company ?? "Unknown company"}</div>
              <div className="text-[12px] text-ink-tertiary mt-0.5 leading-relaxed">
                {f.jobTitle ?? "Untitled role"} · {relativeDueLabel(f.dueDate)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
