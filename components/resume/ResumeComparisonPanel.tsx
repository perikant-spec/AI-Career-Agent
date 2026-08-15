import type { ResumeVersionContent } from "@/lib/resume/generateResumeVersion";

const TAG_LABEL: Record<string, string> = {
  "matched-required": "bg-accent-success-bg text-accent-success-text",
  "matched-nice": "bg-accent-warning-bg text-ink-primary",
  other: "bg-black/5 text-ink-tertiary",
};

export function ResumeComparisonPanel({
  content,
  companyName,
}: {
  content: ResumeVersionContent;
  companyName?: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <div className="bg-card border border-border rounded-card p-5">
        <div className="text-[11px] tracking-wide uppercase text-ink-quaternary mb-2.5">Master resume</div>
        <div className="font-semibold text-[13px] text-ink-primary">Summary</div>
        <div className="text-[13.5px] text-ink-secondary mt-1 mb-3.5 leading-relaxed">
          {content.summary.original || "No summary on file."}
        </div>
        <div className="font-semibold text-[13px] text-ink-primary">Skills</div>
        <div className="text-[13.5px] text-ink-secondary mt-1 leading-relaxed">
          {content.originalSkillOrder.join(", ") || "None on file."}
        </div>
      </div>

      <div className="bg-card border border-accent-success-border rounded-card p-5">
        <div className="text-[11px] tracking-wide uppercase text-accent-success-text mb-2.5">
          Tailored{companyName ? ` for ${companyName}` : ""}
        </div>
        <div className="font-semibold text-[13px] text-ink-primary">Summary</div>
        <div className="text-[13.5px] text-ink-secondary mt-1 mb-3.5 leading-relaxed">
          {content.summary.tailored !== content.summary.original ? (
            <mark className="bg-accent-success-bg px-0.5 rounded-sm">{content.summary.tailored}</mark>
          ) : (
            content.summary.tailored || "No summary on file."
          )}
        </div>
        <div className="font-semibold text-[13px] text-ink-primary mb-1">Skills</div>
        <div className="flex flex-wrap gap-1.5">
          {content.skills.map((s) => (
            <span
              key={s.value}
              className={`text-[11.5px] rounded-[5px] px-1.5 py-0.5 ${TAG_LABEL[s.tag] ?? TAG_LABEL.other}`}
            >
              {s.value}
            </span>
          ))}
        </div>

        {content.experience.map((exp) => (
          <div key={exp.entryId} className="mt-4">
            <div className="font-semibold text-[13px] text-ink-primary">
              {[exp.title, exp.company].filter(Boolean).join(" · ")}
            </div>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {exp.bullets.map((b, i) => (
                <div key={i} className="text-[13px] text-ink-secondary leading-relaxed">
                  {b.adapted ? (
                    <>
                      <span className="line-through text-ink-quaternary text-[12px]">{b.originalText}</span>
                      <br />
                      <mark className="bg-accent-warning-bg px-0.5 rounded-sm">{b.text}</mark>
                    </>
                  ) : b.emphasized ? (
                    <mark className="bg-accent-success-bg px-0.5 rounded-sm">{b.text}</mark>
                  ) : (
                    b.text
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
