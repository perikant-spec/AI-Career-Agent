import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "dark";
};

export function Card({ className = "", tone = "default", children, ...rest }: CardProps) {
  const toneClasses =
    tone === "dark"
      ? "bg-sidebar text-sidebar-text border-sidebar-border"
      : "bg-card text-ink-primary border-border";

  return (
    <div
      className={`rounded-card border ${toneClasses} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
