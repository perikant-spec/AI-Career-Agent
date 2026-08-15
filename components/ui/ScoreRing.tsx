const TIER_COLOR = (score: number) => {
  if (score >= 85) return "oklch(0.68 0.13 165)"; // strong match teal-green
  if (score >= 70) return "oklch(0.72 0.12 175)"; // teal
  if (score >= 55) return "oklch(0.78 0.11 75)"; // amber
  if (score >= 40) return "oklch(0.72 0.13 55)"; // orange
  return "oklch(0.72 0.12 30)"; // risk red
};

export function ScoreRing({
  score,
  size = 56,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const deg = Math.max(0, Math.min(100, score)) * 3.6;
  const color = TIER_COLOR(score);
  const innerSize = size - 14;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(${color} ${deg}deg, #EAE5DA 0)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: `0 0 ${size}px`,
      }}
    >
      <div
        style={{ width: innerSize, height: innerSize, borderRadius: "50%" }}
        className="bg-card flex flex-col items-center justify-center"
      >
        <span
          className="font-mono leading-none"
          style={{ fontSize: Math.max(11, size * 0.27) }}
        >
          {score}
        </span>
        {label ? (
          <span className="text-[9.5px] tracking-wide text-ink-quaternary mt-0.5">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
