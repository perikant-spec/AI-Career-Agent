export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <div className="font-mono text-[11px] tracking-[0.1em] text-ink-quaternary uppercase">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="font-serif text-[38px] font-normal mt-1 leading-tight">{title}</h1>
      {description ? (
        <p className="text-[15px] text-ink-secondary mt-1.5 max-w-[640px]">{description}</p>
      ) : null}
    </div>
  );
}
