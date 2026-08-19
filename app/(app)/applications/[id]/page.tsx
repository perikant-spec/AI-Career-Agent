"use client";

import { useEffect, useState, use as usePromise, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StaticPill } from "@/components/ui/Pill";
import { ResumeComparisonPanel } from "@/components/resume/ResumeComparisonPanel";
import { AtsScoreTiles } from "@/components/resume/AtsScoreTiles";
import { ChangeLogPanel } from "@/components/resume/ChangeLogPanel";
import { LeftOutCallout } from "@/components/resume/LeftOutCallout";
import { CoverLetterTab } from "@/components/applications/CoverLetterTab";
import { QATab } from "@/components/applications/QATab";
import { ChecklistPanel } from "@/components/applications/ChecklistPanel";
import { NetworkingTab } from "@/components/networking/NetworkingTab";
import { FollowUpPanel } from "@/components/followups/FollowUpPanel";
import type { ResumeVersionContent } from "@/lib/resume/generateResumeVersion";
import type { ChangeLogEntry } from "@/lib/resume/customize";
import { APPLICATION_STATUS_LABELS } from "@/lib/types/enums";

interface ApplicationDetail {
  id: string;
  jobId: string;
  status: string;
  job: { title: string | null; company: string | null };
  score: number | null;
  recommendationTier: string | null;
  coverLetter: { content: string; citedEntityIds: string[] } | null;
  qaAnswers: Array<{ question: string; answer: string; citedEntityIds: string[] }> | null;
  resumeApproved: boolean;
  coverLetterApproved: boolean;
  qaApproved: boolean;
  notes: string | null;
  appliedAt: string | null;
}

interface ResumeVersionData {
  content: ResumeVersionContent;
  changeLog: ChangeLogEntry[];
  atsScoreBefore: number;
  atsScoreAfter: number;
}

type Tab = "resume" | "coverLetter" | "qa" | "networking";

export default function ApplicationWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [resumeVersion, setResumeVersion] = useState<ResumeVersionData | null>(null);
  const [tab, setTab] = useState<Tab>("resume");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addedLeftOutItems, setAddedLeftOutItems] = useState<string[]>([]);
  const [pendingLeftOutItem, setPendingLeftOutItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/applications/${id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const body = await res.json();
    setApp(body.application);
    setResumeVersion(body.resumeVersion);
    setLoading(false);
    return body;
  }, [id]);

  useEffect(() => {
    (async () => {
      const body = await load();
      if (body && (!body.resumeVersion || !body.application.coverLetter || !body.application.qaAnswers)) {
        setBusy(true);
        await fetch(`/api/jobs/${body.application.jobId}/apply`, { method: "POST" });
        await load();
        setBusy(false);
      }
    })();
  }, [load]);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await load();
    setBusy(false);
  }

  async function setStatus(status: string) {
    setBusy(true);
    await fetch(`/api/applications/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setBusy(false);
  }

  // Approving a piece only ever changes that piece's own tab (see the disabled/renamed button) —
  // nothing else on screen visibly moves, which reads as the page having silently done nothing.
  // Jumping to the next un-approved tab makes the three-piece gate legible as a sequence instead.
  async function approvePiece(field: "resumeApproved" | "coverLetterApproved" | "qaApproved", nextTab: Tab) {
    await patch({ [field]: true });
    setTab((current) => {
      const stillOnApprovedTab = current === (field === "resumeApproved" ? "resume" : field === "coverLetterApproved" ? "coverLetter" : "qa");
      return stillOnApprovedTab ? nextTab : current;
    });
  }

  async function addLeftOutItem(item: string) {
    setPendingLeftOutItem(item);
    await fetch("/api/profile/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "SKILL", value: item }),
    });
    setAddedLeftOutItems((prev) => [...prev, item]);
    setPendingLeftOutItem(null);
  }

  if (loading || !app) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  const allApproved = app.resumeApproved && app.coverLetterApproved && app.qaApproved;
  const tabs: Array<{ key: Tab; label: string; done: boolean }> = [
    { key: "resume", label: "Resume", done: app.resumeApproved },
    { key: "coverLetter", label: "Cover Letter", done: app.coverLetterApproved },
    { key: "qa", label: "Q&A Answers", done: app.qaApproved },
    { key: "networking", label: "Networking", done: false },
  ];

  return (
    <div className="px-10 py-9 max-w-[1180px]">
      <Link href="/applications" className="text-[12.5px] text-ink-tertiary block mb-4 no-underline">
        ← All applications
      </Link>

      <div className="flex justify-between items-start flex-wrap gap-5">
        <div>
          <div className="font-mono text-[11px] tracking-wide text-ink-quaternary uppercase">
            APPLICATION WORKSPACE{app.score !== null ? ` · ${app.score} MATCH` : ""}
          </div>
          <h1 className="font-serif text-[34px] font-normal mt-1.5">
            {app.job.company ?? "Unknown company"} — {app.job.title ?? "Untitled role"}
          </h1>
          <div className="mt-2">
            <StaticPill tone={app.status === "APPLIED" ? "success" : "default"}>
              {APPLICATION_STATUS_LABELS[app.status as keyof typeof APPLICATION_STATUS_LABELS] ?? app.status}
            </StaticPill>
          </div>
        </div>
        {app.appliedAt ? (
          <div className="bg-card border border-border rounded-card px-4 py-3 text-[12.5px] text-ink-secondary">
            Applied {new Date(app.appliedAt).toLocaleDateString()}
          </div>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => setStatus("APPLIED")}>
            I applied on the employer&apos;s site
          </Button>
        )}
      </div>

      <div className="flex gap-1 mt-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="border-0 bg-transparent px-3.5 pt-2.5 pb-3 font-sans text-[13.5px] cursor-pointer"
            style={{
              fontWeight: tab === t.key ? 600 : 500,
              color: tab === t.key ? "#211F1A" : "#6E6A5F",
              borderBottom: tab === t.key ? "2px solid #1B1A17" : "2px solid transparent",
            }}
          >
            {t.label}
            <span className="text-[11px] text-ink-quaternary ml-1.5 font-mono">{t.done ? "✓" : ""}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5 mt-5 items-start">
        <div className="bg-card border border-border rounded-card p-6 min-h-[420px]">
          {busy && !app.coverLetter && !resumeVersion ? (
            <div className="text-[13.5px] text-ink-tertiary">Preparing your application package…</div>
          ) : tab === "resume" ? (
            resumeVersion ? (
              <div className="flex flex-col gap-3.5">
                <AtsScoreTiles before={resumeVersion.atsScoreBefore} after={resumeVersion.atsScoreAfter} />
                <ResumeComparisonPanel content={resumeVersion.content} companyName={app.job.company} />
                <ChangeLogPanel changeLog={resumeVersion.changeLog} />
                <LeftOutCallout
                  leftOut={resumeVersion.content.leftOut}
                  addedItems={addedLeftOutItems}
                  pendingItem={pendingLeftOutItem}
                  onAdd={addLeftOutItem}
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    disabled={busy || app.resumeApproved}
                    onClick={() => approvePiece("resumeApproved", "coverLetter")}
                  >
                    {app.resumeApproved ? "Approved" : "Approve this piece"}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => patch({ regenerate: "resume" })}>
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-[13.5px] text-ink-tertiary">No resume version yet.</div>
            )
          ) : tab === "coverLetter" ? (
            <CoverLetterTab
              coverLetter={app.coverLetter}
              approved={app.coverLetterApproved}
              busy={busy}
              onApprove={() => approvePiece("coverLetterApproved", "qa")}
              onRegenerate={() => patch({ regenerate: "coverLetter" })}
              onSaveEdit={(text) => patch({ coverLetterText: text })}
            />
          ) : tab === "qa" ? (
            <QATab
              qaAnswers={app.qaAnswers}
              approved={app.qaApproved}
              busy={busy}
              onApprove={() => approvePiece("qaApproved", "qa")}
              onRegenerate={() => patch({ regenerate: "qa" })}
              onSaveAnswer={(index, answer) => patch({ qaAnswerEdit: { index, answer } })}
            />
          ) : (
            <NetworkingTab jobId={app.jobId} />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <ChecklistPanel
            resumeReady={!!resumeVersion}
            coverLetterReady={!!app.coverLetter}
            qaReady={!!app.qaAnswers}
            allApproved={allApproved}
            status={app.status}
            readyToApplyDisabled={busy || !allApproved || app.status === "READY_TO_APPLY" || !!app.appliedAt}
            onReadyToApply={() => setStatus("READY_TO_APPLY")}
          />
          <FollowUpPanel applicationId={id} />
        </div>
      </div>
    </div>
  );
}
