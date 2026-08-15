import { Button } from "@/components/ui/Button";

export function LowConfidenceCallout({
  warnings,
  conflicts,
  onReview,
}: {
  warnings: string[];
  conflicts: { description: string; relatedLabels: string[] }[];
  onReview: () => void;
}) {
  if (warnings.length === 0 && conflicts.length === 0) return null;

  const count = warnings.length + conflicts.length;

  return (
    <div className="mt-4 bg-accent-warning-bg border border-accent-warning-border rounded-xl p-[13px]">
      <div className="text-[12.5px] font-semibold">
        {count} thing{count > 1 ? "s" : ""} need{count === 1 ? "s" : ""} you
      </div>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {conflicts.map((c, i) => (
          <li key={`c-${i}`} className="text-[12.5px] text-ink-secondary leading-relaxed">
            {c.description}
          </li>
        ))}
        {warnings.map((w, i) => (
          <li key={`w-${i}`} className="text-[12.5px] text-ink-secondary leading-relaxed">
            {w}
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="mt-2.5" onClick={onReview}>
        Confirm or correct →
      </Button>
    </div>
  );
}
