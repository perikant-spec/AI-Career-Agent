import { TIER_COLOR } from "@/components/ui/ScoreRing";

/** One row of a Career Search Health breakdown — a label, a linear bar colored by the same
 *  85/70/55/40 tier bands ScoreRing uses (so a score reads the same color everywhere it appears),
 *  and either the score or an honest "no data yet" note when sampleSize is 0. */
export function SubScoreBar({
  label,
  score,
  sampleSize,
}: {
  label: string;
  score: number;
  sampleSize: number;
}) {
  const hasData = sampleSize > 0;

  return (
    <div className="grid grid-cols-[150px_1fr_40px] gap-3.5 items-center">
      <div className="text-[13px] text-ink-primary">{label}</div>
      <div className="h-[10px] bg-black/[0.06] rounded-full overflow-hidden">
        {hasData ? (
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(4, score)}%`, background: TIER_COLOR(score) }}
          />
        ) : null}
      </div>
      <div className="font-mono text-[12.5px] text-right text-ink-primary">
        {hasData ? score : <span className="text-ink-quaternary text-[10.5px]">no data</span>}
      </div>
    </div>
  );
}
