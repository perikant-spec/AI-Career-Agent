import { useRouter } from "next/navigation";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/types/enums";
import { StatusSelect } from "./StatusSelect";
import { daysSince } from "./daysSince";
import type { ApplicationTrackerItem } from "./types";

export function ApplicationListTable({
  applications,
  onStatusChange,
}: {
  applications: ApplicationTrackerItem[];
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const router = useRouter();

  return (
    <div className="mt-6 bg-card border border-border rounded-card overflow-hidden max-w-[1080px]">
      <div className="grid grid-cols-[1.4fr_1.6fr_1.2fr_0.7fr_1fr] gap-3.5 px-4.5 py-3 bg-bg text-[11px] tracking-wide uppercase text-ink-quaternary">
        <span>Company</span>
        <span>Role</span>
        <span>Status</span>
        <span>Match</span>
        <span>Last activity</span>
      </div>
      {applications.map((a) => (
        <div
          key={a.id}
          onClick={() => router.push(`/applications/${a.id}`)}
          className="grid grid-cols-[1.4fr_1.6fr_1.2fr_0.7fr_1fr] gap-3.5 px-4.5 py-3.5 border-t border-[#F0ECE1] text-[13.5px] items-center cursor-pointer hover:bg-black/[0.02]"
        >
          <span className="font-semibold">{a.company ?? "Unknown company"}</span>
          <span className="text-ink-secondary">{a.title ?? "Untitled role"}</span>
          <span>
            <StatusSelect compact value={a.status} onChange={(status) => onStatusChange(a.id, status)} />
          </span>
          <span className="font-mono text-[12.5px]">{a.score ?? "—"}</span>
          <span className="text-ink-tertiary text-[12.5px]">{daysSince(a.updatedAt)}</span>
        </div>
      ))}
      {applications.length === 0 ? (
        <div className="px-4.5 py-6 text-[13px] text-ink-tertiary">Nothing here yet.</div>
      ) : null}
    </div>
  );
}

// Re-exported so pages can reference the label map without importing enums directly everywhere.
export { APPLICATION_STATUS_LABELS };
