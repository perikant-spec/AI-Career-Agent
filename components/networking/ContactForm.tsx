"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTACT_TYPES, CONTACT_TYPE_LABELS, type ContactType } from "@/lib/types/enums";

export interface NewContactInput {
  name: string;
  role?: string;
  contactType: ContactType;
  relationshipNote?: string;
  warmth?: number;
  profileUrl?: string;
}

export function ContactForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (input: NewContactInput) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [contactType, setContactType] = useState<ContactType>("HIRING_MANAGER");
  const [relationshipNote, setRelationshipNote] = useState("");
  const [warmth, setWarmth] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      role: role.trim() || undefined,
      contactType,
      relationshipNote: relationshipNote.trim() || undefined,
      warmth: warmth ? Number(warmth) : undefined,
      profileUrl: profileUrl.trim() || undefined,
    });
    setName("");
    setRole("");
    setRelationshipNote("");
    setWarmth("");
    setProfileUrl("");
  }

  const inputClass =
    "rounded-btn border border-border-strong bg-card px-3 py-2 text-[13.5px] text-ink-primary outline-none focus:border-ink-quaternary";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
        />
        <input
          placeholder="Role (optional)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <select
          value={contactType}
          onChange={(e) => setContactType(e.target.value as ContactType)}
          className={inputClass}
        >
          {CONTACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          placeholder="LinkedIn profile URL (optional)"
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          className={inputClass}
        />
      </div>
      <textarea
        placeholder="How do you know them, or why are they relevant? (optional — your own note, never guessed)"
        value={relationshipNote}
        onChange={(e) => setRelationshipNote(e.target.value)}
        rows={2}
        className={inputClass}
      />
      <div className="flex items-center gap-2.5">
        <label className="text-[12.5px] text-ink-tertiary">Warmth</label>
        <input
          type="number"
          min={0}
          max={100}
          placeholder="0-100"
          value={warmth}
          onChange={(e) => setWarmth(e.target.value)}
          className={`${inputClass} w-24`}
        />
        <Button type="submit" variant="primary" disabled={submitting} className="ml-auto">
          {submitting ? "Adding…" : "Add contact"}
        </Button>
      </div>
    </form>
  );
}
