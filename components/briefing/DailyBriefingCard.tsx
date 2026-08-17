"use client";

import { useEffect, useState } from "react";

interface DailyBriefingResponse {
  headline: string;
  lines: string[];
}

/** Self-fetching sidebar card, same convention as FollowUpQueue.tsx: fetch on mount, render
 *  nothing while loading/empty rather than a placeholder skeleton, since this app's sidebar
 *  favors quiet absence over loading chrome. */
export function DailyBriefingCard() {
  const [briefing, setBriefing] = useState<DailyBriefingResponse | null>(null);

  useEffect(() => {
    fetch("/api/daily-briefing")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body) setBriefing(body);
      });
  }, []);

  if (!briefing || briefing.lines.length === 0) return null;

  return (
    <div>
      <div className="text-[10.5px] tracking-[0.12em] uppercase text-ink-quaternary mb-2.5">
        Your daily briefing
      </div>
      <div className="bg-card border border-border rounded-xl px-3.5 py-3">
        <div className="text-[13.5px] font-semibold">{briefing.headline}</div>
        <div className="flex flex-col gap-1 mt-1.5">
          {briefing.lines.map((line, i) => (
            <div key={i} className="text-[12px] text-ink-secondary leading-relaxed">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
