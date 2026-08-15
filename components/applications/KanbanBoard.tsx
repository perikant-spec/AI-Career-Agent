import { useRouter } from "next/navigation";
import { APPLICATION_STATUS_ORDER, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/types/enums";
import { StatusSelect } from "./StatusSelect";
import { daysSince } from "./daysSince";
import type { ApplicationTrackerItem } from "./types";

export function KanbanBoard({
  applications,
  onStatusChange,
}: {
  applications: ApplicationTrackerItem[];
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const router = useRouter();

  return (
    <div className="flex gap-3 mt-6 overflow-x-auto pb-3">
      {APPLICATION_STATUS_ORDER.map((status) => {
        const cards = applications.filter((a) => a.status === status);
        return (
          <div key={status} className="w-[236px] flex-none bg-black/[0.04] rounded-2xl p-3">
            <div className="flex justify-between items-center px-1 pb-2.5">
              <span className="text-[12.5px] font-semibold">{APPLICATION_STATUS_LABELS[status]}</span>
              <span className="font-mono text-[11.5px] text-ink-quaternary">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/applications/${c.id}`)}
                  className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-border-strong"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="text-[13px] font-semibold leading-tight">{c.company ?? "Unknown company"}</span>
                    {c.score !== null ? (
                      <span className="font-mono text-[11px] text-ink-tertiary">{c.score}</span>
                    ) : null}
                  </div>
                  <div className="text-[12px] text-ink-tertiary mt-1 leading-snug">
                    {c.title ?? "Untitled role"}
                  </div>
                  <div className="text-[11px] text-ink-quaternary mt-2">{daysSince(c.updatedAt)}</div>
                  <div className="mt-2">
                    <StatusSelect
                      compact
                      value={c.status}
                      onChange={(newStatus) => onStatusChange(c.id, newStatus)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
