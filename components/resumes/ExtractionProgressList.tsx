import { Card } from "@/components/ui/Card";

export type ExtractionStep = {
  label: string;
  state: "pending" | "active" | "done" | "error";
  detail?: string;
};

const DOT_CLASSES: Record<ExtractionStep["state"], string> = {
  pending: "bg-border-strong",
  active: "bg-accent-warning",
  done: "bg-accent-success",
  error: "bg-accent-risk",
};

export function ExtractionProgressList({ steps }: { steps: ExtractionStep[] }) {
  const doneCount = steps.filter((s) => s.state === "done").length;

  return (
    <Card className="p-[22px]">
      <div className="flex justify-between items-baseline">
        <div className="text-[13.5px] font-semibold">Extraction</div>
        <div className="font-mono text-[11.5px] text-ink-tertiary">
          {doneCount} of {steps.length} complete
        </div>
      </div>
      <div className="h-1 bg-[#EAE5DA] rounded mt-2.5 mb-4 overflow-hidden">
        <div
          className="h-full bg-accent-teal transition-all"
          style={{ width: `${(doneCount / Math.max(steps.length, 1)) * 100}%` }}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 py-2 border-b border-[#F0ECE1] last:border-b-0"
          >
            <span className={`w-[7px] h-[7px] rounded-full flex-none ${DOT_CLASSES[step.state]}`} />
            <span className="flex-1 text-[13.5px]">{step.label}</span>
            {step.detail ? (
              <span className="text-[12px] text-ink-tertiary font-mono">{step.detail}</span>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
