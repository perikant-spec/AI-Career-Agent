import { Card } from "@/components/ui/Card";
import { MATCH_CATEGORIES, MATCH_CATEGORY_LABELS, type MatchCategory } from "@/lib/types/enums";

function barColor(score: number): string {
  if (score >= 85) return "oklch(0.68 0.13 165)";
  if (score >= 70) return "oklch(0.72 0.12 175)";
  if (score >= 55) return "oklch(0.78 0.11 75)";
  if (score >= 40) return "oklch(0.72 0.13 55)";
  return "oklch(0.72 0.12 30)";
}

export function CategoryBreakdownBars({ categoryScores }: { categoryScores: Record<MatchCategory, number> }) {
  return (
    <Card className="p-[22px]">
      <div className="flex justify-between items-baseline mb-3.5">
        <div className="text-[14px] font-semibold">Category breakdown</div>
        <div className="font-mono text-[11.5px] text-ink-tertiary">
          WEIGHTED · SKILLS/EXP/SENIORITY ARE GATES
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {MATCH_CATEGORIES.map((category: MatchCategory) => (
          <div key={category} className="grid grid-cols-[150px_1fr_42px] gap-3.5 items-center">
            <div className="text-[13px] text-ink-primary">{MATCH_CATEGORY_LABELS[category]}</div>
            <div className="h-[7px] bg-[#EFEBE0] rounded overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${categoryScores[category]}%`, background: barColor(categoryScores[category]) }}
              />
            </div>
            <div className="font-mono text-[12.5px] text-right">{categoryScores[category]}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
