export function LeftOutCallout({ leftOut }: { leftOut: string[] }) {
  if (leftOut.length === 0) return null;

  return (
    <div className="bg-accent-risk-bg border border-accent-risk-border rounded-xl p-[18px]">
      <div className="text-[12.5px] font-semibold text-accent-risk-text">Left out on purpose</div>
      <div className="text-[12.5px] text-ink-primary mt-1.5 leading-relaxed">
        This posting asks for {leftOut.length === 1 ? leftOut[0] : leftOut.slice(0, -1).join(", ") + " and " + leftOut[leftOut.length - 1]}.
        Your profile shows no trace of {leftOut.length > 1 ? "these" : "this"} — flagged as a gap,
        never written in.
      </div>
    </div>
  );
}
