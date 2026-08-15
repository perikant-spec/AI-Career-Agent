import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function ComingLaterPlaceholder({
  title,
  description,
  milestone,
  whatItWillDo,
}: {
  title: string;
  description: string;
  milestone: string;
  whatItWillDo: string[];
}) {
  return (
    <div className="px-10 py-11 max-w-[720px]">
      <SectionHeader title={title} description={description} />

      <Card className="p-6 mt-7">
        <div className="text-[12.5px] font-mono text-ink-quaternary tracking-wide uppercase mb-2">
          {milestone}
        </div>
        <div className="text-[14px] text-ink-secondary mb-3.5">
          This isn&apos;t built yet in the current phase. Nothing here fabricates data in the
          meantime — the nav item stays visible so the product&apos;s full shape is honest about
          what&apos;s coming, not because this page does anything yet.
        </div>
        <div className="text-[12.5px] font-semibold text-ink-primary mb-1.5">
          What this will do once built:
        </div>
        <ul className="flex flex-col gap-1">
          {whatItWillDo.map((item, i) => (
            <li key={i} className="text-[13px] text-ink-secondary flex gap-2">
              <span className="text-ink-quaternary">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
