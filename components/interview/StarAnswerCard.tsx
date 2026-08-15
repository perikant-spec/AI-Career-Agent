"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { INTERVIEW_QUESTION_CATEGORY_LABELS, type InterviewQuestionCategory } from "@/lib/types/enums";

interface MockAttempt {
  id: string;
  responseText: string;
  scoreRelevance: number;
  scoreClarity: number;
  scoreStructure: number;
  scoreCompleteness: number;
  feedback: string;
}

interface QuestionDetail {
  id: string;
  category: string;
  question: string;
  star: { situation: string | null; task: string | null; action: string | null; result: string | null };
  citedEntityIds: string[];
  rehearsed: boolean;
  mockAttempts: MockAttempt[];
}

const STAR_ROWS: Array<{ key: keyof QuestionDetail["star"]; label: string }> = [
  { key: "situation", label: "Situation" },
  { key: "task", label: "Task" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] text-ink-tertiary w-[84px]">{label}</span>
      <div className="flex-1 h-[6px] bg-black/[0.06] rounded-full overflow-hidden">
        <div className="h-full bg-accent-teal" style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[11px] text-ink-tertiary w-6 text-right">{value}</span>
    </div>
  );
}

export function StarAnswerCard({
  question,
  busy,
  onMarkRehearsed,
  onSubmitMockResponse,
}: {
  question: QuestionDetail;
  busy: boolean;
  onMarkRehearsed: () => void;
  onSubmitMockResponse: (text: string) => void;
}) {
  const [responseDraft, setResponseDraft] = useState("");
  const latestAttempt = question.mockAttempts[0];

  return (
    <Card className="p-[22px]">
      <div className="text-[11px] tracking-wide uppercase text-ink-quaternary">
        {INTERVIEW_QUESTION_CATEGORY_LABELS[question.category as InterviewQuestionCategory]} · likely
      </div>
      <div className="text-[17px] font-semibold my-2 leading-snug">&quot;{question.question}&quot;</div>

      <div className="flex flex-col gap-3 mt-4">
        {STAR_ROWS.map(({ key, label }) => {
          const value = question.star[key];
          return (
            <div key={key} className="grid grid-cols-[82px_1fr] gap-3.5">
              <div className="text-[11px] tracking-wide uppercase text-ink-quaternary pt-0.5">{label}</div>
              <div className="text-[14px] leading-relaxed text-ink-primary">
                {value ?? <span className="text-ink-quaternary italic">Not captured in your resume.</span>}
              </div>
            </div>
          );
        })}
      </div>

      {question.citedEntityIds.length > 0 ? (
        <div className="text-[11px] text-ink-quaternary mt-3.5 font-mono">
          Grounded in {question.citedEntityIds.length} verified profile {question.citedEntityIds.length === 1 ? "entry" : "entries"}.
        </div>
      ) : (
        <div className="text-[11px] text-ink-quaternary mt-3.5">
          No specific verified evidence available for this one — worth preparing your own example.
        </div>
      )}

      <div className="flex gap-2 mt-4 flex-wrap">
        <Button variant={question.rehearsed ? "secondary" : "primary"} disabled={busy} onClick={onMarkRehearsed}>
          {question.rehearsed ? "Rehearsed ✓" : "Mark rehearsed"}
        </Button>
      </div>

      <div className="mt-5 pt-4 border-t border-[#F0ECE1]">
        <div className="text-[12.5px] font-semibold mb-2">Mock response</div>
        <textarea
          value={responseDraft}
          onChange={(e) => setResponseDraft(e.target.value)}
          placeholder="Type your answer as you'd say it out loud…"
          rows={4}
          className="w-full max-w-[560px] text-[13.5px] leading-relaxed border border-border-strong rounded-btn p-2.5 font-sans"
        />
        <div className="mt-2">
          <Button
            variant="secondary"
            disabled={busy || !responseDraft.trim()}
            onClick={() => {
              onSubmitMockResponse(responseDraft);
              setResponseDraft("");
            }}
          >
            Score this response
          </Button>
        </div>

        {latestAttempt ? (
          <div className="mt-3.5 bg-black/[0.03] rounded-btn p-3.5 flex flex-col gap-2">
            <ScoreBar label="Relevance" value={latestAttempt.scoreRelevance} />
            <ScoreBar label="Clarity" value={latestAttempt.scoreClarity} />
            <ScoreBar label="Structure" value={latestAttempt.scoreStructure} />
            <ScoreBar label="Completeness" value={latestAttempt.scoreCompleteness} />
            <div className="text-[12.5px] text-ink-primary leading-relaxed mt-1">{latestAttempt.feedback}</div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
