"use client";

import { useEffect, useState, use as usePromise, useCallback } from "react";
import Link from "next/link";
import { QuestionSetSidebar } from "@/components/interview/QuestionSetSidebar";
import { StarAnswerCard } from "@/components/interview/StarAnswerCard";
import { CompanyResearchPanel } from "@/components/interview/CompanyResearchPanel";
import { utcToZonedParts, formatZonedDateTime } from "@/lib/time";

interface MockAttempt {
  id: string;
  responseText: string;
  scoreRelevance: number;
  scoreClarity: number;
  scoreStructure: number;
  scoreCompleteness: number;
  feedback: string;
}

interface QuestionDetail {
  id: string;
  category: string;
  question: string;
  star: { situation: string | null; task: string | null; action: string | null; result: string | null };
  citedEntityIds: string[];
  rehearsed: boolean;
  mockAttempts: MockAttempt[];
}

interface InterviewPrepData {
  id: string;
  companyResearch: Array<{ label: string; text: string }>;
  scheduledAt: string | null;
  readiness: number;
  rehearsedCount: number;
  totalCount: number;
  questions: QuestionDetail[];
}

function toDatetimeLocalValue(iso: string, timezone: string): string {
  const parts = utcToZonedParts(new Date(iso), timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export default function InterviewPrepPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = usePromise(params);
  const [prep, setPrep] = useState<InterviewPrepData | null>(null);
  const [eligible, setEligible] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [scheduleInput, setScheduleInput] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const load = useCallback(async () => {
    const [prepRes, prefsRes] = await Promise.all([
      fetch(`/api/applications/${applicationId}/interview-prep`),
      fetch("/api/preferences"),
    ]);
    const tz = prefsRes.ok ? ((await prefsRes.json()).preferences.timezone ?? "UTC") : "UTC";
    setTimezone(tz);

    if (!prepRes.ok) {
      setLoading(false);
      return;
    }
    const body = await prepRes.json();
    setEligible(body.eligible);
    setUpgradeRequired(Boolean(body.upgradeRequired));
    setPrep(body.interviewPrep);
    setScheduleInput(body.interviewPrep?.scheduledAt ? toDatetimeLocalValue(body.interviewPrep.scheduledAt, tz) : "");
    setLoading(false);
    setSelectedId((current) => current ?? body.interviewPrep?.questions?.[0]?.id ?? null);
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRehearsed(questionId: string, rehearsed: boolean) {
    setBusy(true);
    await fetch(`/api/interview-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rehearsed }),
    });
    await load();
    setBusy(false);
  }

  async function submitMockResponse(questionId: string, responseText: string) {
    setBusy(true);
    await fetch(`/api/interview-questions/${questionId}/mock-attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responseText }),
    });
    await load();
    setBusy(false);
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    await fetch(`/api/applications/${applicationId}/interview-prep`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAtLocal: scheduleInput || null }),
    });
    await load();
    setSavingSchedule(false);
  }

  if (loading) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  if (upgradeRequired) {
    return (
      <div className="px-10 py-11 max-w-[720px] text-[13.5px] text-ink-tertiary">
        This application is at Interview stage, but interview prep is a Pro feature.{" "}
        <Link href="/settings" className="underline text-accent-teal">
          Upgrade to Pro
        </Link>{" "}
        to generate company research, STAR answers, and mock-interview scoring for it.
      </div>
    );
  }

  if (!eligible || !prep) {
    return (
      <div className="px-10 py-11 max-w-[720px] text-[13.5px] text-ink-tertiary">
        This application isn&apos;t at Interview stage yet — prep builds automatically once it is.{" "}
        <Link href={`/applications/${applicationId}`}>Open the application</Link>.
      </div>
    );
  }

  const selectedQuestion = prep.questions.find((q) => q.id === selectedId) ?? prep.questions[0];

  return (
    <div className="px-10 py-9 max-w-[1180px]">
      <Link href={`/applications/${applicationId}`} className="text-[12.5px] text-ink-tertiary block mb-4 no-underline">
        ← Back to application
      </Link>

      <div className="flex justify-between items-end flex-wrap gap-5">
        <div>
          <h1 className="font-serif text-[34px] font-normal">Interview preparation</h1>
          <p className="text-[15px] text-ink-secondary mt-1.5 max-w-[640px]">
            Built automatically when this application moved to Interview. Answers draw only on
            verified evidence — nothing invented.
          </p>
        </div>
        <div className="bg-card border border-border rounded-card px-4.5 py-3.5 min-w-[186px]">
          <div className="text-[11.5px] text-ink-tertiary">Readiness</div>
          <div className="font-mono text-[24px]">{prep.readiness}%</div>
          <div className="h-[5px] bg-black/[0.06] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-accent-warning" style={{ width: `${prep.readiness}%` }} />
          </div>
          <div className="text-[11px] text-ink-quaternary mt-1.5">
            {prep.rehearsedCount} of {prep.totalCount} answers rehearsed
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-card px-4.5 py-3.5 mt-4 max-w-[420px]">
        <div className="text-[11.5px] text-ink-tertiary mb-1.5">Interview time</div>
        {prep.scheduledAt ? (
          <div className="text-[13.5px] mb-2">
            {formatZonedDateTime(new Date(prep.scheduledAt), timezone, "long")}
            <span className="text-ink-quaternary text-[11.5px]"> ({timezone})</span>
          </div>
        ) : (
          <div className="text-[12.5px] text-ink-tertiary mb-2">
            No time set yet — the daily briefing will say &quot;you have an upcoming interview&quot; without a time until you add one.
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={scheduleInput}
            onChange={(e) => setScheduleInput(e.target.value)}
            className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[13.5px] outline-none focus:border-ink-quaternary"
          />
          <button
            onClick={saveSchedule}
            disabled={savingSchedule}
            className="text-[12.5px] font-medium px-3 py-2 rounded-btn border border-border-strong hover:border-ink-quaternary disabled:opacity-50"
          >
            {savingSchedule ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[236px_1fr_272px] gap-4 mt-6 items-start">
        <QuestionSetSidebar questions={prep.questions} selectedId={selectedQuestion?.id ?? null} onSelect={setSelectedId} />

        {selectedQuestion ? (
          <StarAnswerCard
            question={selectedQuestion}
            busy={busy}
            onMarkRehearsed={() => markRehearsed(selectedQuestion.id, !selectedQuestion.rehearsed)}
            onSubmitMockResponse={(text) => submitMockResponse(selectedQuestion.id, text)}
          />
        ) : (
          <div className="text-[13.5px] text-ink-tertiary">No questions generated.</div>
        )}

        <CompanyResearchPanel snippets={prep.companyResearch} />
      </div>
    </div>
  );
}
