"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProfileEntryRow, type ProfileEntryData } from "./ProfileEntryRow";

export function ProfileSectionCard({
  title,
  entries,
  onSave,
  onConfirm,
  onDelete,
  onAdd,
}: {
  title: string;
  entries: ProfileEntryData[];
  onSave: (id: string, value: string) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAdd: (value: string) => Promise<void>;
}) {
  const [addingValue, setAddingValue] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!addingValue.trim()) return;
    setAdding(true);
    await onAdd(addingValue.trim());
    setAddingValue("");
    setAdding(false);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center px-[18px] py-3.5 border-b border-[#F0ECE1]">
        <div className="text-[14px] font-semibold">{title}</div>
        <div className="font-mono text-[11.5px] text-ink-tertiary">{entries.length}</div>
      </div>
      <div className="px-[18px]">
        {entries.length === 0 ? (
          <div className="py-3.5 text-[13px] text-ink-tertiary">Nothing here yet.</div>
        ) : (
          entries.map((entry) => (
            <ProfileEntryRow
              key={entry.id}
              entry={entry}
              onSave={onSave}
              onConfirm={onConfirm}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
      <div className="flex gap-2 items-center px-[18px] py-3 border-t border-[#F0ECE1] bg-[#FBF9F3]">
        <input
          value={addingValue}
          onChange={(e) => setAddingValue(e.target.value)}
          placeholder="Add something manually…"
          className="flex-1 rounded-btn border border-border-strong bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-quaternary"
        />
        <Button variant="secondary" disabled={adding || !addingValue.trim()} onClick={handleAdd}>
          Add
        </Button>
      </div>
    </Card>
  );
}
