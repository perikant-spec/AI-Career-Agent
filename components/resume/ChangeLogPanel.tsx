import { Card } from "@/components/ui/Card";
import type { ChangeLogEntry } from "@/lib/resume/customize";

const KIND_COLOR: Record<ChangeLogEntry["kind"], string> = {
  REORDERED: "text-accent-link",
  EMPHASIZED: "text-accent-success-text",
  REWORDED: "text-ink-primary",
  TERM_ADAPTED: "text-accent-warning",
};

const KIND_LABEL: Record<ChangeLogEntry["kind"], string> = {
  REORDERED: "REORDERED",
  EMPHASIZED: "EMPHASIZED",
  REWORDED: "REWORDED",
  TERM_ADAPTED: "TERM ADAPTED",
};

export function ChangeLogPanel({ changeLog }: { changeLog: ChangeLogEntry[] }) {
  return (
    <Card className="p-[18px]">
      <div className="text-[12.5px] font-semibold mb-2.5">Change log</div>
      {changeLog.length === 0 ? (
        <div className="text-[12.5px] text-ink-tertiary">
          Nothing needed reordering for this posting — your master resume already led with what
          matters here.
        </div>
      ) : (
        changeLog.map((c, i) => (
          <div key={i} className="py-2 border-b border-[#F5F2E9] last:border-b-0">
            <div className={`text-[10px] font-bold tracking-wide ${KIND_COLOR[c.kind]}`}>{KIND_LABEL[c.kind]}</div>
            <div className="text-[12.5px] text-ink-primary mt-0.5 leading-relaxed">{c.text}</div>
          </div>
        ))
      )}
    </Card>
  );
}
