"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StaticPill } from "@/components/ui/Pill";
import { BillingCard } from "@/components/settings/BillingCard";
import { AccountActionsCard } from "@/components/settings/AccountActionsCard";

interface Preferences {
  targetTitles: string[];
  targetLocations: string[];
  salaryFloor: number | null;
  workAuthorization: string | null;
  followUpDays: number;
}

interface JobSource {
  id: string;
  name: string;
  configured: boolean;
  description: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [sources, setSources] = useState<JobSource[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [titlesInput, setTitlesInput] = useState("");
  const [locationsInput, setLocationsInput] = useState("");
  const [salaryFloorInput, setSalaryFloorInput] = useState("");
  const [workAuthInput, setWorkAuthInput] = useState("");
  const [followUpDaysInput, setFollowUpDaysInput] = useState("7");

  const load = useCallback(async () => {
    const [prefsRes, sourcesRes] = await Promise.all([
      fetch("/api/preferences"),
      fetch("/api/job-sources"),
    ]);
    if (!prefsRes.ok || !sourcesRes.ok) return;
    const prefsBody = await prefsRes.json();
    const sourcesBody = await sourcesRes.json();
    setPrefs(prefsBody.preferences);
    setTitlesInput((prefsBody.preferences.targetTitles ?? []).join(", "));
    setLocationsInput((prefsBody.preferences.targetLocations ?? []).join(", "));
    setSalaryFloorInput(prefsBody.preferences.salaryFloor ? String(prefsBody.preferences.salaryFloor) : "");
    setWorkAuthInput(prefsBody.preferences.workAuthorization ?? "");
    setFollowUpDaysInput(String(prefsBody.preferences.followUpDays ?? 7));
    setSources(sourcesBody.sources);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetTitles: titlesInput.split(",").map((s) => s.trim()).filter(Boolean),
        targetLocations: locationsInput.split(",").map((s) => s.trim()).filter(Boolean),
        salaryFloor: salaryFloorInput ? parseInt(salaryFloorInput, 10) : null,
        workAuthorization: workAuthInput.trim() || null,
        followUpDays: followUpDaysInput ? parseInt(followUpDaysInput, 10) : 7,
      }),
    });
    setSaving(false);
    setSaved(true);
    load();
  }

  if (!prefs || !sources) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  return (
    <div className="px-10 py-11 max-w-[720px]">
      <SectionHeader
        title="Settings"
        description="Account, search preferences, and job-source connections. Data export/delete live here too."
      />

      <div className="flex flex-col gap-4 mt-7">
        <Card className="p-5">
          <div className="text-[13.5px] font-semibold mb-3">Account</div>
          <div className="text-[13px] text-ink-secondary">{session?.user?.name}</div>
          <div className="text-[13px] text-ink-tertiary">{session?.user?.email}</div>
        </Card>

        <Suspense fallback={<Card className="p-5 text-[13px] text-ink-tertiary">Loading…</Card>}>
          <BillingCard />
        </Suspense>

        <Card className="p-5">
          <div className="text-[13.5px] font-semibold mb-1">Search preferences</div>
          <div className="text-[12.5px] text-ink-tertiary mb-3.5">
            Optional — improves match scoring for location and compensation. Never blocks anything.
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
              Target titles (comma-separated)
              <input
                value={titlesInput}
                onChange={(e) => setTitlesInput(e.target.value)}
                placeholder="Product Manager, Group Product Manager"
                className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] outline-none focus:border-ink-quaternary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
              Target locations (comma-separated, e.g. &quot;Austin, TX&quot;)
              <input
                value={locationsInput}
                onChange={(e) => setLocationsInput(e.target.value)}
                placeholder="Austin, TX, Remote"
                className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] outline-none focus:border-ink-quaternary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
              Salary floor (USD)
              <input
                value={salaryFloorInput}
                onChange={(e) => setSalaryFloorInput(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="140000"
                className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] outline-none focus:border-ink-quaternary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
              Work authorization
              <input
                value={workAuthInput}
                onChange={(e) => setWorkAuthInput(e.target.value)}
                placeholder="e.g. Authorized to work in the US without sponsorship"
                className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] outline-none focus:border-ink-quaternary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
              Follow up after (days)
              <input
                value={followUpDaysInput}
                onChange={(e) => setFollowUpDaysInput(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="7"
                className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] outline-none focus:border-ink-quaternary w-24"
              />
              <span className="text-[11.5px] text-ink-quaternary">
                A follow-up reminder is scheduled this many days after you mark an application
                Applied. Fixed timer for now — response-rate-informed timing is a later phase.
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2.5 mt-4">
            <Button variant="primary" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save preferences"}
            </Button>
            {saved ? <span className="text-[12.5px] text-accent-success-text">Saved.</span> : null}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[13.5px] font-semibold mb-3">Job sources</div>
          <div className="flex flex-col gap-2.5">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border border-border rounded-xl px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium">{s.name}</span>
                    <StaticPill tone={s.configured ? "success" : "default"}>
                      {s.configured ? "Connected" : "Not connected"}
                    </StaticPill>
                  </div>
                  <div className="text-[12px] text-ink-tertiary mt-0.5">{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <AccountActionsCard />
      </div>
    </div>
  );
}
