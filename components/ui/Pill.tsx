import type { ButtonHTMLAttributes } from "react";

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function Pill({ className = "", active = false, children, ...rest }: PillProps) {
  const stateClasses = active
    ? "bg-sidebar text-sidebar-text border-transparent"
    : "bg-card text-ink-secondary border-border-strong hover:border-ink-quaternary";

  return (
    <button
      className={`rounded-pill border px-3.5 py-1.5 text-[12.5px] font-sans cursor-pointer transition-colors ${stateClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function StaticPill({
  className = "",
  tone = "default",
  children,
}: {
  className?: string;
  tone?: "default" | "success" | "warning" | "risk";
  children: React.ReactNode;
}) {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    default: "bg-black/5 text-ink-tertiary",
    success: "bg-accent-success-bg text-accent-success-text",
    warning: "bg-accent-warning-bg text-ink-primary",
    risk: "bg-accent-risk-bg text-accent-risk-text",
  };

  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
