"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dropzone } from "@/components/resumes/Dropzone";
import { ExtractionProgressList, type ExtractionStep } from "@/components/resumes/ExtractionProgressList";
import { LowConfidenceCallout } from "@/components/resumes/LowConfidenceCallout";

type UploadOutcome = {
  fileName: string;
  extractionStatus: string;
  extractionError?: string;
  profileEntriesCreated: number;
  warnings: string[];
  conflicts: { description: string; relatedLabels: string[] }[];
};

export default function ResumeUploadPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "uploading" | "extracting" | "done" | "error">("idle");
  const [outcome, setOutcome] = useState<UploadOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setOutcome(null);
    setPhase("uploading");

    const formData = new FormData();
    formData.append("file", file);

    setPhase("extracting");
    const res = await fetch("/api/resumes", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? "Something went wrong uploading your resume.");
      setPhase("error");
      return;
    }

    setOutcome({
      fileName: body.resume.fileName,
      extractionStatus: body.resume.extractionStatus,
      extractionError: body.resume.extractionError,
      profileEntriesCreated: body.profileEntriesCreated,
      warnings: body.warnings ?? [],
      conflicts: body.conflicts ?? [],
    });
    setPhase("done");
  }

  const steps: ExtractionStep[] = outcome
    ? [
        { label: "Uploading file", state: "done" },
        {
          label: "Extracting text",
          state: outcome.extractionStatus === "SUCCESS" ? "done" : "error",
        },
        {
          label: "Building career profile",
          state: outcome.extractionStatus === "SUCCESS" ? "done" : "pending",
          detail:
            outcome.extractionStatus === "SUCCESS"
              ? `${outcome.profileEntriesCreated} fields`
              : undefined,
        },
      ]
    : phase === "uploading" || phase === "extracting"
      ? [
          { label: "Uploading file", state: phase === "uploading" ? "active" : "done" },
          { label: "Extracting text", state: phase === "extracting" ? "active" : "pending" },
          { label: "Building career profile", state: "pending" },
        ]
      : [];

  return (
    <div className="px-10 py-11 max-w-[1060px]">
      <SectionHeader
        eyebrow="Step 1 of 3 · Resume"
        title="Start with your resume."
        description="Everything the agent writes later traces back to this document. Preferences can wait — you'll never be blocked on them."
      />

      <div className="grid grid-cols-2 gap-4 mt-7">
        <Card className="p-[22px]">
          <Dropzone onFileSelected={handleFile} disabled={phase === "uploading" || phase === "extracting"} />

          {outcome ? (
            <div className="flex items-center gap-2.5 mt-4 bg-[#F2F0E7] rounded-[11px] px-3.5 py-3">
              <div className="w-8 h-8 rounded-lg bg-[#E3DFD2] flex items-center justify-center text-[10px] font-mono flex-none">
                {outcome.fileName.split(".").pop()?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold truncate">{outcome.fileName}</div>
                <div className="text-[11.5px] text-ink-tertiary">
                  {outcome.extractionStatus === "SUCCESS" ? "parsed" : "needs attention"}
                </div>
              </div>
              <span
                className={`text-[11.5px] font-semibold ${
                  outcome.extractionStatus === "SUCCESS" ? "text-accent-success-text" : "text-accent-risk-text"
                }`}
              >
                {outcome.extractionStatus === "SUCCESS" ? "Done" : "Failed"}
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3.5 text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2">
              {error}
            </div>
          ) : null}

          {outcome?.extractionError ? (
            <div className="mt-3.5 text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2">
              {outcome.extractionError}
            </div>
          ) : null}

          <div className="text-[11.5px] text-ink-quaternary mt-3.5 leading-relaxed">
            Stored encrypted at rest. Never used to train models unless you turn that on in
            Settings.
          </div>
        </Card>

        <div>
          {steps.length > 0 ? <ExtractionProgressList steps={steps} /> : (
            <Card className="p-[22px] text-[13.5px] text-ink-tertiary">
              Upload a resume to see extraction progress here.
            </Card>
          )}

          {outcome && outcome.extractionStatus === "SUCCESS" ? (
            <LowConfidenceCallout
              warnings={outcome.warnings}
              conflicts={outcome.conflicts}
              onReview={() => router.push("/profile")}
            />
          ) : null}
        </div>
      </div>

      <Card className="mt-4 p-[22px] flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="text-[13.5px] font-semibold">Optional: search preferences</div>
          <div className="text-[12.5px] text-ink-tertiary mt-1">
            Target titles, locations, salary floor, work authorization. Improves scoring — not
            required to continue.
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/settings")}>
            Add now
          </Button>
          <Button
            variant="primary"
            disabled={!outcome || outcome.extractionStatus !== "SUCCESS"}
            onClick={() => router.push("/jobs")}
          >
            Skip to jobs
          </Button>
        </div>
      </Card>
    </div>
  );
}
