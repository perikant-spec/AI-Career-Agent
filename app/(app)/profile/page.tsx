"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { ConfidenceMeter } from "@/components/profile/ConfidenceMeter";
import { ProfileSectionCard } from "@/components/profile/ProfileSectionCard";
import type { ProfileEntryData } from "@/components/profile/ProfileEntryRow";
import type { ProfileSection } from "@/lib/types/enums";

const SECTION_LABELS: Record<ProfileSection, string> = {
  SUMMARY: "Summary",
  SKILL: "Skills",
  EXPERIENCE: "Experience",
  EDUCATION: "Education",
  CERTIFICATION: "Certifications",
  ACHIEVEMENT: "Achievements",
};

const SECTION_ORDER: ProfileSection[] = [
  "SUMMARY",
  "EXPERIENCE",
  "SKILL",
  "EDUCATION",
  "CERTIFICATION",
  "ACHIEVEMENT",
];

interface ProfileResponse {
  sections: Record<string, ProfileEntryData[]>;
  counts: Record<string, number>;
  overallConfidence: number;
  totalEntries: number;
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileResponse | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (!res.ok) return;
    const body = await res.json();
    setData(body);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(id: string, value: string) {
    await fetch(`/api/profile/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    load();
  }

  async function handleConfirm(id: string) {
    await fetch(`/api/profile/entries/${id}/confirm`, { method: "POST" });
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/profile/entries/${id}`, { method: "DELETE" });
    load();
  }

  async function handleAdd(section: ProfileSection, value: string) {
    await fetch("/api/profile/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, value }),
    });
    load();
  }

  if (!data) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  return (
    <div className="px-10 py-11 max-w-[1100px]">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <SectionHeader
          title="Career profile"
          description="Every field is labelled by how the agent knows it. Confirm or correct anything that isn't right — downstream writing only draws from what's here."
        />
        <ConfidenceMeter
          score={data.overallConfidence}
          verified={data.counts.VERIFIED ?? 0}
          inferred={data.counts.SUPPORTED_INFERENCE ?? 0}
          missing={data.counts.MISSING ?? 0}
        />
      </div>

      <div className="flex gap-1.5 my-6 flex-wrap items-center">
        <span className="flex items-center gap-1.5 text-[12px] border border-border-strong rounded-pill px-2.5 py-1 bg-card">
          <ConfidenceBadge level="VERIFIED" /> in your resume text
        </span>
        <span className="flex items-center gap-1.5 text-[12px] border border-border-strong rounded-pill px-2.5 py-1 bg-card">
          <ConfidenceBadge level="SUPPORTED_INFERENCE" /> implied, shown as inference
        </span>
        <span className="flex items-center gap-1.5 text-[12px] border border-border-strong rounded-pill px-2.5 py-1 bg-card">
          <ConfidenceBadge level="MISSING" /> asked for, no trace
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {SECTION_ORDER.map((section) => (
          <ProfileSectionCard
            key={section}
            title={SECTION_LABELS[section]}
            entries={data.sections[section] ?? []}
            onSave={handleSave}
            onConfirm={handleConfirm}
            onDelete={handleDelete}
            onAdd={(value) => handleAdd(section, value)}
          />
        ))}
      </div>
    </div>
  );
}
