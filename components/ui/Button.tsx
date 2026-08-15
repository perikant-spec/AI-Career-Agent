import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "accent";
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-sidebar text-sidebar-text hover:bg-sidebar-hover border border-transparent",
  accent:
    "bg-accent-teal text-accent-teal-ink hover:brightness-95 border border-transparent font-semibold",
  secondary:
    "bg-card text-ink-secondary border border-border-strong hover:border-ink-quaternary",
  ghost:
    "bg-transparent text-ink-tertiary border border-transparent hover:bg-black/5",
  destructive:
    "bg-transparent text-accent-risk-text border border-accent-risk-border hover:bg-accent-risk-bg",
};

export function Button({
  className = "",
  variant = "secondary",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`rounded-btn px-4 py-2 text-[13.5px] font-medium font-sans transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
