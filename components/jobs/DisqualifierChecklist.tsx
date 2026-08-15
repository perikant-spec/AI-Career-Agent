import { Card } from "@/components/ui/Card";

export function DisqualifierChecklist({
  disqualifiers,
}: {
  disqualifiers: { code: string; reason: string }[];
}) {
  const hasHardFail = disqualifiers.length > 0;

  return (
    <Card className="p-[18px]">
      <div className="text-[12.5px] font-semibold mb-2">Disqualifier check</div>
      {hasHardFail ? (
        disqualifiers.map((d) => (
          <div key={d.code} className="flex items-start gap-2 py-1.5 text-[12.5px] border-b border-[#F5F2E9] last:border-b-0">
            <span className="w-[7px] h-[7px] rounded-full bg-accent-risk flex-none mt-1" />
            <span className="text-ink-primary">{d.reason}</span>
          </div>
        ))
      ) : (
        <div className="flex items-center gap-2 py-1.5 text-[12.5px]">
          <span className="w-[7px] h-[7px] rounded-full bg-accent-success flex-none" />
          <span className="text-ink-primary">No hard disqualifiers found.</span>
        </div>
      )}
      <div className="text-[11.5px] text-ink-quaternary mt-2.5">
        Any hard fail forces Don&apos;t Apply regardless of score.
      </div>
    </Card>
  );
}
