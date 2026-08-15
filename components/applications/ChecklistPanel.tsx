import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ChecklistItem {
  label: string;
  done: boolean;
}

export function ChecklistPanel({
  resumeReady,
  coverLetterReady,
  qaReady,
  allApproved,
  onReadyToApply,
  readyToApplyDisabled,
  status,
}: {
  resumeReady: boolean;
  coverLetterReady: boolean;
  qaReady: boolean;
  allApproved: boolean;
  onReadyToApply: () => void;
  readyToApplyDisabled: boolean;
  status: string;
}) {
  const items: ChecklistItem[] = [
    { label: "Resume prepared", done: resumeReady },
    { label: "Cover letter prepared", done: coverLetterReady },
    { label: "Application answers completed", done: qaReady },
    { label: "You've reviewed and approved everything", done: allApproved },
  ];

  return (
    <Card className="p-[18px]">
      <div className="text-[12.5px] font-semibold mb-2.5">Gate before submitting</div>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2.5 py-1.5 text-[12.5px]">
          <span
            className={`w-[14px] h-[14px] rounded flex-none border-[1.5px] ${
              item.done ? "bg-accent-success border-accent-success" : "border-border-strong bg-transparent"
            }`}
          />
          <span className="text-ink-primary">{item.label}</span>
        </div>
      ))}
      <div className="text-[11.5px] text-ink-quaternary mt-2.5">
        You submit on the employer&apos;s site. The agent never applies for you.
      </div>
      <Button
        variant={allApproved ? "accent" : "secondary"}
        className="w-full mt-3.5"
        disabled={readyToApplyDisabled}
        onClick={onReadyToApply}
      >
        {status === "READY_TO_APPLY" ? "Marked ready to apply" : "Ready to apply"}
      </Button>
    </Card>
  );
}
