import { Card } from "@/components/ui/Card";

interface ResearchSnippet {
  label: string;
  text: string;
}

export function CompanyResearchPanel({ snippets }: { snippets: ResearchSnippet[] }) {
  return (
    <Card className="p-[18px]">
      <div className="text-[12.5px] font-semibold mb-2.5">Company research</div>
      {snippets.length === 0 ? (
        <div className="text-[12px] text-ink-tertiary leading-relaxed">
          Nothing extractable from this posting&apos;s text — no web research runs in this build,
          so this stays empty rather than guessing.
        </div>
      ) : (
        snippets.map((s, i) => (
          <div key={i} className="py-2 border-b border-[#F5F2E9] last:border-b-0">
            <div className="text-[11px] tracking-wide uppercase text-ink-quaternary">{s.label}</div>
            <div className="text-[12.5px] text-ink-primary mt-0.5 leading-relaxed">{s.text}</div>
          </div>
        ))
      )}
      <div className="text-[10.5px] text-ink-quaternary mt-2.5">From the job posting text only.</div>
    </Card>
  );
}
