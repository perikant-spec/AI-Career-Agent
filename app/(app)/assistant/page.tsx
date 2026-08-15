"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { StatTile } from "@/components/ui/StatTile";
import { ChatThread, type ChatMessage } from "@/components/assistant/ChatThread";
import { ChatComposer } from "@/components/assistant/ChatComposer";
import { IntentChip } from "@/components/assistant/IntentChip";
import { FollowUpQueue } from "@/components/followups/FollowUpQueue";

interface JobSummary {
  score: { overallScore: number; recommendationTier: string } | null;
}

interface ApplicationSummary {
  status: string;
  packageReady: boolean;
}

interface FollowUpSummary {
  status: string;
  isDue: boolean;
}

const SUGGESTED_INTENTS = [
  "What should I apply to today?",
  "Why was this job marked don't apply?",
  "Prepare my application for this job",
  "Have I applied here before?",
  "Why am I not hearing back?",
  "Prepare me for my interview",
];

export default function AssistantHomePage() {
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);

  const loadJobs = useCallback(async () => {
    const [jobsRes, appsRes, followUpsRes] = await Promise.all([
      fetch("/api/jobs"),
      fetch("/api/applications"),
      fetch("/api/follow-ups"),
    ]);
    if (jobsRes.ok) setJobs((await jobsRes.json()).jobs ?? []); // transient/auth hiccup — keep whatever was last shown
    if (appsRes.ok) setApplications((await appsRes.json()).applications ?? []);
    if (followUpsRes.ok) setFollowUps((await followUpsRes.json()).followUps ?? []);
  }, []);

  useEffect(() => {
    loadJobs();
    // Re-fetch if the authenticated user changes without a full remount (e.g. sign-out then
    // sign-in as someone else landing back on this same route).
  }, [loadJobs, session?.user?.id]);

  const newMatches = jobs.filter(
    (j) => j.score && ["APPLY_STRONG", "APPLY"].includes(j.score.recommendationTier)
  ).length;
  const strongMatches = jobs.filter((j) => j.score && j.score.overallScore >= 85).length;
  const dontApplyCount = jobs.filter((j) => j.score?.recommendationTier === "DONT_APPLY").length;
  const totalScored = jobs.filter((j) => j.score).length;
  const readyForReview = applications.filter((a) => a.packageReady).length;
  const liveApplications = applications.filter((a) => a.status !== "DISCOVERED").length;
  const followUpsDue = followUps.filter((f) => f.status === "PENDING" && f.isDue).length;

  async function handleSend(message: string) {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setPending(true);

    const res = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const body = await res.json();

    setPending(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: body.reply ?? "Something went wrong — try again." },
    ]);
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? session?.user?.email?.split("@")[0] ?? "there";

  return (
    <div className="grid grid-cols-[1fr_336px] min-h-screen">
      <section className="px-10 pt-11 flex flex-col min-w-0">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <h1 className="font-serif text-[44px] font-normal tracking-tight m-0">
            Good morning, {firstName}.
          </h1>
        </div>
        <p className="text-[16px] text-ink-secondary mt-2.5 mb-6 max-w-[620px]">
          Here&apos;s your job search today. {totalScored === 0
            ? "Upload a resume and paste a job to get your first match score."
            : `${newMatches} job${newMatches === 1 ? "" : "s"} clear your usual bar${
                dontApplyCount > 0 ? `, and ${dontApplyCount} say don't apply.` : "."
              }`}
        </p>

        <div className="grid grid-cols-4 gap-3">
          <StatTile value={newMatches} label="New matches" note={strongMatches > 0 ? `${strongMatches} above 85%` : undefined} noteTone="success" />
          <StatTile value={readyForReview} label="Ready for review" noteTone="warning" />
          <StatTile value={liveApplications} label="Live applications" />
          <StatTile value={followUpsDue} label="Follow-ups due" noteTone="risk" />
        </div>

        <div className="flex-1 flex flex-col gap-4 py-7 min-h-0">
          {messages.length === 0 ? (
            <div className="text-[13.5px] text-ink-tertiary">
              Ask me what to apply to today, or why a job scored the way it did.
            </div>
          ) : (
            <ChatThread messages={messages} pending={pending} />
          )}
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-bg via-bg to-transparent pt-3.5 pb-6">
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {SUGGESTED_INTENTS.map((label) => (
              <IntentChip key={label} label={label} onClick={() => handleSend(label)} />
            ))}
          </div>
          <ChatComposer onSend={handleSend} disabled={pending} />
        </div>
      </section>

      <aside className="border-l border-border bg-[#FBF9F3] px-6 py-8 flex flex-col gap-5">
        <FollowUpQueue />
        <div>
          <div className="text-[10.5px] tracking-[0.12em] uppercase text-ink-quaternary mb-2.5">
            This week
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5">
            <div className="flex justify-between text-[13px] py-1">
              <span className="text-ink-secondary">Jobs scored</span>
              <span className="font-mono">{totalScored}</span>
            </div>
            <div className="flex justify-between text-[13px] py-1">
              <span className="text-ink-secondary">Apply-worthy</span>
              <span className="font-mono">{newMatches}</span>
            </div>
            <div className="flex justify-between text-[13px] py-1">
              <span className="text-ink-secondary">Don&apos;t-apply saves</span>
              <span className="font-mono">{dontApplyCount}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
