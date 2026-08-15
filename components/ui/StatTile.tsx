import { Card } from "./Card";

export function StatTile({
  value,
  label,
  note,
  noteTone = "default",
}: {
  value: string | number;
  label: string;
  note?: string;
  noteTone?: "default" | "success" | "warning" | "risk";
}) {
  const noteClasses: Record<NonNullable<typeof noteTone>, string> = {
    default: "text-ink-tertiary",
    success: "text-accent-success-text",
    warning: "text-ink-secondary",
    risk: "text-accent-risk-text",
  };

  return (
    <Card className="px-4 py-3.5">
      <div className="font-mono text-[26px] leading-none tracking-tight">{value}</div>
      <div className="text-[12.5px] text-ink-secondary mt-1">{label}</div>
      {note ? (
        <div className={`text-[11px] mt-1.5 ${noteClasses[noteTone]}`}>{note}</div>
      ) : null}
    </Card>
  );
}
