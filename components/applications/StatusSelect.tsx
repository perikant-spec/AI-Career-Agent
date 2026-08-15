import { APPLICATION_STATUS_ORDER, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/types/enums";

// A dropdown rather than drag-and-drop — "user can manually change status" doesn't require a
// DnD dependency, and this is far less to get wrong across kanban/list/mobile at once.
export function StatusSelect({
  value,
  onChange,
  compact = false,
}: {
  value: ApplicationStatus;
  onChange: (status: ApplicationStatus) => void;
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ApplicationStatus)}
      onClick={(e) => e.stopPropagation()}
      className={`bg-card border border-border-strong rounded-btn text-ink-primary font-sans cursor-pointer ${
        compact ? "text-[11.5px] px-1.5 py-1" : "text-[12.5px] px-2 py-1.5"
      }`}
    >
      {APPLICATION_STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {APPLICATION_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
