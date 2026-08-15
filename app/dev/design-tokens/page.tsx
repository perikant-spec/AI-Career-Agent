import { notFound } from "next/navigation";
import { Card, Button, ConfidenceBadge, ScoreRing, StatTile, Pill, StaticPill, SectionHeader } from "@/components/ui";

// Scratch page to visually validate the design token system against the source mockup
// before any backend is wired up. Superseded by the real dashboard in a later step.
export default function DesignTokenScratchPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-bg p-10 flex flex-col gap-8">
      <SectionHeader
        eyebrow="Design token check"
        title="Good morning, Peri."
        description="Here's your job search today. Two matches clear your 85% bar."
      />

      <div className="grid grid-cols-4 gap-3 max-w-3xl">
        <StatTile value={4} label="New matches" note="2 above 85%" noteTone="success" />
        <StatTile value={1} label="Ready for review" note="Globex · drafted 9m ago" noteTone="warning" />
        <StatTile value={1} label="Follow-up due" note="Acme · day 8" noteTone="risk" />
        <StatTile value={12} label="Live applications" note="3 in interview" />
      </div>

      <div className="flex items-center gap-4">
        <ScoreRing score={87} size={96} label="MATCH" />
        <ScoreRing score={62} size={56} />
        <ScoreRing score={38} size={56} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <ConfidenceBadge level="VERIFIED" />
        <ConfidenceBadge level="SUPPORTED_INFERENCE" />
        <ConfidenceBadge level="NOT_VERIFIED" />
        <ConfidenceBadge level="MISSING" />
        <StaticPill tone="success">Apply — strong match</StaticPill>
        <StaticPill tone="risk">Don&apos;t apply</StaticPill>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="primary">Prepare application</Button>
        <Button variant="accent">Ready to apply</Button>
        <Button variant="secondary">Edit</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="destructive">Delete</Button>
        <Pill active>Recommended</Pill>
        <Pill>All jobs</Pill>
      </div>

      <Card className="p-6 max-w-xl">
        <div className="font-serif text-[28px]">Career profile</div>
        <p className="text-ink-secondary text-[14px] mt-2">
          Every field is labelled by how the agent knows it — Instrument Serif headings,
          Instrument Sans body, IBM Plex Mono numerals.
        </p>
      </Card>

      <Card tone="dark" className="p-6 max-w-xl">
        <div className="text-[14px] font-semibold">Next step</div>
        <div className="text-[13px] text-sidebar-text-dim mt-1.5">
          Dark sidebar surface check — should read #1B1A17 with cream text.
        </div>
      </Card>
    </div>
  );
}
