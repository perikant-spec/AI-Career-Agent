"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KanbanBoard } from "@/components/applications/KanbanBoard";
import { ApplicationListTable } from "@/components/applications/ApplicationListTable";
import type { ApplicationTrackerItem } from "@/components/applications/types";
import type { ApplicationStatus } from "@/lib/types/enums";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationTrackerItem[] | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const load = useCallback(async () => {
    const res = await fetch("/api/applications");
    if (!res.ok) return;
    const body = await res.json();
    setApplications(body.applications ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    setApplications((prev) => (prev ? prev.map((a) => (a.id === id ? { ...a, status } : a)) : prev));
    await fetch(`/api/applications/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const live = applications?.filter((a) => a.status !== "DISCOVERED").length ?? 0;

  return (
    <div className="px-10 py-11">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <SectionHeader
          title="Application tracker"
          description={`${live} live application${live === 1 ? "" : "s"}. Status changes are yours to confirm — nothing here moves a card silently.`}
        />
        <div className="flex bg-black/[0.04] rounded-xl p-0.5">
          <button
            onClick={() => setView("kanban")}
            className={`rounded-[10px] px-3.5 py-1.5 text-[12.5px] cursor-pointer ${view === "kanban" ? "bg-sidebar text-sidebar-text" : "text-ink-secondary"}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-[10px] px-3.5 py-1.5 text-[12.5px] cursor-pointer ${view === "list" ? "bg-sidebar text-sidebar-text" : "text-ink-secondary"}`}
          >
            List
          </button>
        </div>
      </div>

      {applications === null ? (
        <div className="text-[13.5px] text-ink-tertiary mt-6">Loading…</div>
      ) : view === "kanban" ? (
        <KanbanBoard applications={applications} onStatusChange={handleStatusChange} />
      ) : (
        <ApplicationListTable applications={applications} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
