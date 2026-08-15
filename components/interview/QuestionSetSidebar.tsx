import { Card } from "@/components/ui/Card";
import { INTERVIEW_QUESTION_CATEGORIES, INTERVIEW_QUESTION_CATEGORY_LABELS } from "@/lib/types/enums";

interface QuestionSummary {
  id: string;
  category: string;
  question: string;
  rehearsed: boolean;
}

export function QuestionSetSidebar({
  questions,
  selectedId,
  onSelect,
}: {
  questions: QuestionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="p-3.5">
      <div className="text-[11px] tracking-wide uppercase text-ink-quaternary px-1.5 pb-2">Question sets</div>
      {INTERVIEW_QUESTION_CATEGORIES.map((category) => {
        const inCategory = questions.filter((q) => q.category === category);
        if (inCategory.length === 0) return null;
        return (
          <div key={category} className="mb-2.5">
            <div className="text-[10.5px] font-semibold text-ink-tertiary px-1.5 mb-1">
              {INTERVIEW_QUESTION_CATEGORY_LABELS[category as keyof typeof INTERVIEW_QUESTION_CATEGORY_LABELS]}
            </div>
            {inCategory.map((q) => (
              <button
                key={q.id}
                onClick={() => onSelect(q.id)}
                className="w-full text-left border-0 rounded-[9px] px-2.5 py-2 text-[12.5px] cursor-pointer font-sans"
                style={{
                  background: selectedId === q.id ? "#F2EFE6" : "transparent",
                  color: q.rehearsed ? "#6E6A5F" : "#3A382F",
                }}
              >
                {q.rehearsed ? "✓ " : ""}
                {q.question.length > 46 ? `${q.question.slice(0, 46)}…` : q.question}
              </button>
            ))}
          </div>
        );
      })}
    </Card>
  );
}
