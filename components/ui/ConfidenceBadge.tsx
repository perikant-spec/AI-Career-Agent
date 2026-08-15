import type { ConfidenceLevel } from "@/lib/types/enums";

const CONFIG: Record<ConfidenceLevel, { label: string; classes: string }> = {
  VERIFIED: {
    label: "Verified",
    classes: "bg-accent-success-bg text-accent-success-text border-accent-success-border",
  },
  SUPPORTED_INFERENCE: {
    label: "Inferred",
    classes: "bg-accent-warning-bg text-ink-primary border-accent-warning-border",
  },
  NOT_VERIFIED: {
    label: "Not verified",
    classes: "bg-black/5 text-ink-tertiary border-border-strong",
  },
  MISSING: {
    label: "Missing",
    classes: "bg-accent-risk-bg text-accent-risk-text border-accent-risk-border",
  },
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const { label, classes } = CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[5px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide font-sans ${classes}`}
    >
      {label}
    </span>
  );
}

export function ConfidenceDot({ level }: { level: ConfidenceLevel }) {
  const dotColor: Record<ConfidenceLevel, string> = {
    VERIFIED: "bg-accent-success",
    SUPPORTED_INFERENCE: "bg-accent-warning",
    NOT_VERIFIED: "bg-ink-quaternary",
    MISSING: "bg-accent-risk",
  };
  return <span className={`inline-block h-[7px] w-[7px] rounded-full ${dotColor[level]}`} />;
}
