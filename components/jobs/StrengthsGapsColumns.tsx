import { Card } from "@/components/ui/Card";

export function StrengthsGapsColumns({ strengths, gaps }: { strengths: string[]; gaps: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 mt-3.5">
      <Card className="p-5">
        <div className="text-[13.5px] font-semibold mb-2.5">Strengths</div>
        {strengths.length === 0 ? (
          <div className="text-[13px] text-ink-tertiary">Nothing stood out as a strength here.</div>
        ) : (
          strengths.map((s, i) => (
            <div key={i} className="flex gap-2 py-1.5 text-[13px] text-ink-primary leading-relaxed">
              <span className="text-accent-success">▪</span>
              <span>{s}</span>
            </div>
          ))
        )}
      </Card>
      <Card className="p-5">
        <div className="text-[13.5px] font-semibold mb-2.5">Gaps &amp; risks</div>
        {gaps.length === 0 ? (
          <div className="text-[13px] text-ink-tertiary">No significant gaps identified.</div>
        ) : (
          gaps.map((g, i) => (
            <div key={i} className="flex gap-2 py-1.5 text-[13px] text-ink-primary leading-relaxed">
              <span className="text-accent-warning">▪</span>
              <span>{g}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
