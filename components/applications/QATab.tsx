"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface QAItem {
  question: string;
  answer: string;
  citedEntityIds: string[];
}

export function QATab({
  qaAnswers,
  approved,
  onApprove,
  onRegenerate,
  onSaveAnswer,
  busy,
}: {
  qaAnswers: QAItem[] | null;
  approved: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
  onSaveAnswer: (index: number, text: string) => void;
  busy: boolean;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (!qaAnswers || qaAnswers.length === 0) {
    return <div className="text-[13.5px] text-ink-tertiary">No application answers generated yet.</div>;
  }

  return (
    <div>
      <div className="text-[13px] text-ink-tertiary mb-3.5">Application answers</div>
      <div className="flex flex-col gap-5 max-w-[640px]">
        {qaAnswers.map((item, i) => (
          <div key={i}>
            <div className="text-[13.5px] font-semibold text-ink-primary">{item.question}</div>
            {editingIndex === i ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full text-[14px] leading-relaxed border border-border-strong rounded-btn p-2.5 mt-1.5 font-sans"
              />
            ) : (
              <div className="text-[14px] leading-relaxed text-ink-secondary mt-1.5">{item.answer}</div>
            )}
            <div className="flex gap-2 mt-2">
              {editingIndex === i ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    onSaveAnswer(i, draft);
                    setEditingIndex(null);
                  }}
                >
                  Save
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDraft(item.answer);
                    setEditingIndex(i);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-5 flex-wrap">
        <Button variant="primary" disabled={busy || approved} onClick={onApprove}>
          {approved ? "Approved" : "Approve this piece"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onRegenerate}>
          Regenerate
        </Button>
      </div>
    </div>
  );
}
