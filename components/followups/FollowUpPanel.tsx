"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StaticPill } from "@/components/ui/Pill";
import { relativeDueLabel } from "./types";

interface FollowUpDetail {
  id: string;
  dueDate: string;
  status: string;
  isDue: boolean;
  draftedMessage: { content: string; citedEntityIds: string[] } | null;
}

export function FollowUpPanel({ applicationId }: { applicationId: string }) {
  const [followUp, setFollowUp] = useState<FollowUpDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [showDraft, setShowDraft] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/follow-ups?applicationId=${applicationId}`);
    if (!res.ok) return;
    const body = await res.json();
    setFollowUp(body.followUps[0] ?? null);
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateDraft(force = false) {
    if (!followUp) return;
    setBusy(true);
    await fetch(`/api/follow-ups/${followUp.id}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    await load();
    setShowDraft(true);
    setBusy(false);
  }

  async function setStatus(status: string) {
    if (!followUp) return;
    setBusy(true);
    await fetch(`/api/follow-ups/${followUp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setBusy(false);
  }

  async function snooze(days: number) {
    if (!followUp) return;
    setBusy(true);
    const newDue = new Date(new Date(followUp.dueDate).getTime() + days * 24 * 60 * 60 * 1000);
    await fetch(`/api/follow-ups/${followUp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: newDue.toISOString() }),
    });
    await load();
    setBusy(false);
  }

  if (followUp === undefined) return null;

  if (!followUp) {
    return (
      <Card className="p-[18px]">
        <div className="text-[12.5px] font-semibold mb-1.5">Follow-up</div>
        <div className="text-[12px] text-ink-tertiary leading-relaxed">
          Scheduled automatically once you mark this application Applied.
        </div>
      </Card>
    );
  }

  if (followUp.status !== "PENDING") {
    return (
      <Card className="p-[18px]">
        <div className="text-[12.5px] font-semibold mb-1.5">Follow-up</div>
        <StaticPill tone={followUp.status === "COMPLETED" ? "success" : "default"}>
          {followUp.status === "COMPLETED" ? "Followed up" : "Dismissed"}
        </StaticPill>
      </Card>
    );
  }

  return (
    <Card className="p-[18px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[12.5px] font-semibold">Follow-up</div>
        {followUp.isDue ? <StaticPill tone="risk">Due</StaticPill> : null}
      </div>
      <div className="text-[12.5px] text-ink-secondary">{relativeDueLabel(followUp.dueDate)}</div>

      {followUp.draftedMessage && showDraft ? (
        <div className="text-[12.5px] text-ink-primary leading-relaxed mt-2.5 bg-black/[0.03] rounded-btn p-2.5 whitespace-pre-line">
          {followUp.draftedMessage.content}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 mt-3">
        {!followUp.draftedMessage ? (
          <Button variant="secondary" disabled={busy} onClick={() => generateDraft(false)}>
            Draft follow-up message
          </Button>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => (showDraft ? setShowDraft(false) : setShowDraft(true))}
            >
              {showDraft ? "Hide draft" : "View draft"}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => generateDraft(true)}>
              Regenerate
            </Button>
          </div>
        )}
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="primary" disabled={busy} onClick={() => setStatus("COMPLETED")}>
            Mark as followed up
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => snooze(3)}>
            Snooze 3 days
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setStatus("DISMISSED")}>
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  );
}
