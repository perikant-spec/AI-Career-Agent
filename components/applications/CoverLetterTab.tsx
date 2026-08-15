"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

export function CoverLetterTab({
  coverLetter,
  approved,
  onApprove,
  onRegenerate,
  onSaveEdit,
  busy,
}: {
  coverLetter: { content: string; citedEntityIds: string[] } | null;
  approved: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
  onSaveEdit: (text: string) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(coverLetter?.content ?? "");

  useEffect(() => {
    setDraft(coverLetter?.content ?? "");
    setEditing(false);
  }, [coverLetter?.content]);

  if (!coverLetter) {
    return <div className="text-[13.5px] text-ink-tertiary">No cover letter generated yet.</div>;
  }

  return (
    <div>
      <div className="text-[13px] text-ink-tertiary mb-3.5">Cover letter</div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          className="w-full max-w-[640px] text-[14.5px] leading-relaxed border border-border-strong rounded-btn p-3 font-sans"
        />
      ) : (
        <div className="text-[14.5px] leading-relaxed text-ink-primary whitespace-pre-line max-w-[640px]">
          {coverLetter.content}
        </div>
      )}
      {coverLetter.citedEntityIds.length > 0 ? (
        <div className="text-[11.5px] text-ink-quaternary mt-3">
          Grounded in {coverLetter.citedEntityIds.length} verified profile{" "}
          {coverLetter.citedEntityIds.length === 1 ? "entry" : "entries"}.
        </div>
      ) : (
        <div className="text-[11.5px] text-ink-quaternary mt-3">
          No specific profile evidence was cited{editing || draft !== coverLetter.content ? " — edited by you." : "."}
        </div>
      )}
      <div className="flex gap-2 mt-4 flex-wrap">
        {editing ? (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              onSaveEdit(draft);
              setEditing(false);
            }}
          >
            Save edit
          </Button>
        ) : (
          <Button variant="primary" disabled={busy || approved} onClick={onApprove}>
            {approved ? "Approved" : "Approve this piece"}
          </Button>
        )}
        <Button variant="secondary" disabled={busy} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onRegenerate}>
          Regenerate
        </Button>
      </div>
    </div>
  );
}
