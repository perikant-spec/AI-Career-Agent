"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { Button } from "@/components/ui/Button";
import type { ConfidenceLevel } from "@/lib/types/enums";

export interface ProfileEntryData {
  id: string;
  value: string;
  label: string | null;
  confidence: ConfidenceLevel;
  basisText: string | null;
  userConfirmed: boolean;
}

export function ProfileEntryRow({
  entry,
  onSave,
  onConfirm,
  onDelete,
}: {
  entry: ProfileEntryData;
  onSave: (id: string, value: string) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(entry.id, draft);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex items-start gap-3.5 py-3.5 border-b border-[#F5F2E9] last:border-b-0">
      <div className="mt-0.5">
        <ConfidenceBadge level={entry.confidence} />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full rounded-btn border border-border-strong bg-card px-2.5 py-1.5 text-[14px] outline-none focus:border-ink-quaternary"
          />
        ) : (
          <div className="text-[14px] text-ink-primary whitespace-pre-line">{entry.value || "—"}</div>
        )}
        {entry.basisText ? (
          <div className="text-[12px] text-ink-tertiary mt-1 leading-relaxed">{entry.basisText}</div>
        ) : null}
      </div>
      <div className="flex gap-1.5 flex-none">
        {editing ? (
          <>
            <Button variant="secondary" disabled={saving} onClick={handleSave}>
              Save
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setDraft(entry.value);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            {!entry.userConfirmed && entry.confidence !== "MISSING" ? (
              <Button variant="secondary" onClick={() => onConfirm(entry.id)}>
                Confirm
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="ghost" onClick={() => onDelete(entry.id)}>
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
