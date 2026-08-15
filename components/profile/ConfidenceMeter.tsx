import { Card } from "@/components/ui/Card";

export function ConfidenceMeter({
  score,
  verified,
  inferred,
  missing,
}: {
  score: number;
  verified: number;
  inferred: number;
  missing: number;
}) {
  return (
    <Card className="px-4 py-3 min-w-[210px]">
      <div className="text-[11.5px] text-ink-tertiary">Profile confidence</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[24px]">{score}</span>
        <span className="text-[12px] text-ink-tertiary">/ 100</span>
      </div>
      <div className="flex gap-0.5 mt-2">
        <span
          className="h-[5px] rounded-sm bg-accent-success"
          style={{ flex: Math.max(verified, 0.001) }}
        />
        <span
          className="h-[5px] rounded-sm bg-accent-warning"
          style={{ flex: Math.max(inferred, 0.001) }}
        />
        <span
          className="h-[5px] rounded-sm bg-accent-risk"
          style={{ flex: Math.max(missing, 0.001) }}
        />
      </div>
      <div className="text-[11px] text-ink-quaternary mt-1.5">
        {verified} verified · {inferred} inferred · {missing} missing
      </div>
    </Card>
  );
}
