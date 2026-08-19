export function LeftOutCallout({
  leftOut,
  addedItems = [],
  pendingItem,
  onAdd,
}: {
  leftOut: string[];
  /** Items already added to the Career Profile this session — shown as done, not re-offered. */
  addedItems?: string[];
  /** Item currently being added, so its button can show a busy state. */
  pendingItem?: string | null;
  /** Called with the raw item text when the user asks to add it to their Career Profile. */
  onAdd?: (item: string) => void;
}) {
  if (leftOut.length === 0) return null;

  return (
    <div className="bg-accent-risk-bg border border-accent-risk-border rounded-xl p-[18px]">
      <div className="text-[12.5px] font-semibold text-accent-risk-text">Left out on purpose</div>
      <div className="text-[12.5px] text-ink-primary mt-1.5 leading-relaxed">
        This posting asks for {leftOut.length === 1 ? leftOut[0] : leftOut.slice(0, -1).join(", ") + " and " + leftOut[leftOut.length - 1]}.
        Your profile shows no trace of {leftOut.length > 1 ? "these" : "this"} — flagged as a gap,
        never written in.
      </div>
      {onAdd ? (
        <div className="flex flex-col gap-1.5 mt-3">
          {leftOut.map((item) => {
            const added = addedItems.includes(item);
            const pending = pendingItem === item;
            return (
              <div key={item} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-ink-primary">{item}</span>
                {added ? (
                  <span className="text-accent-success-text font-medium">Added to your Career Profile</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onAdd(item)}
                    className="text-[12px] font-medium text-accent-risk-text bg-transparent border border-accent-risk-border rounded-btn px-2.5 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? "Adding…" : "+ Add to Career Profile"}
                  </button>
                )}
              </div>
            );
          })}
          <div className="text-[11px] text-ink-quaternary mt-0.5">
            Only add this if it&apos;s actually true. It&apos;s saved to your Career Profile as
            your own unverified claim, for your own record — this app never weaves a manually-typed
            claim into a tailored resume, cover letter, or interview answer, the same as everywhere
            else here. To have it actually used, it needs to come from an uploaded resume.
          </div>
        </div>
      ) : null}
    </div>
  );
}
