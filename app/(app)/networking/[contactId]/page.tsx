"use client";

import { useEffect, useState, use as usePromise, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StaticPill } from "@/components/ui/Pill";
import {
  OUTREACH_MESSAGE_TYPES,
  OUTREACH_MESSAGE_TYPE_LABELS,
  CONTACT_TYPE_LABELS,
  type OutreachMessageType,
  type ContactType,
} from "@/lib/types/enums";

interface MessageState {
  id: string;
  content: string;
  citedEntityIds: string[];
  status: string;
  sentAt: string | null;
}

interface ContactDetail {
  id: string;
  jobId: string;
  jobTitle: string | null;
  company: string | null;
  name: string;
  role: string | null;
  contactType: string;
  source: string;
  relationshipNote: string | null;
  warmth: number | null;
  profileUrl: string | null;
  messages: Record<string, MessageState | null>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function OutreachPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = usePromise(params);
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [activeType, setActiveType] = useState<OutreachMessageType>("CONNECTION_REQUEST");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contacts/${contactId}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const body = await res.json();
    setContact(body.contact);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setEditing(false);
    setDraft(contact?.messages[activeType]?.content ?? "");
    setGenerateError(null);
    setUpgradeRequired(false);
  }, [activeType, contact]);

  async function generate(force = false) {
    setBusy(true);
    setGenerateError(null);
    setUpgradeRequired(false);
    const res = await fetch(`/api/contacts/${contactId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: activeType, force }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setGenerateError(body.error ?? "Couldn't generate a draft.");
      setUpgradeRequired(Boolean(body.upgradeRequired));
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  async function saveEdit() {
    setBusy(true);
    await fetch(`/api/contacts/${contactId}/messages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: activeType, content: draft }),
    });
    await load();
    setBusy(false);
    setEditing(false);
  }

  async function markSent() {
    setBusy(true);
    await fetch(`/api/contacts/${contactId}/messages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: activeType, status: "SENT" }),
    });
    await load();
    setBusy(false);
  }

  if (loading || !contact) {
    return <div className="px-10 py-11 text-[13.5px] text-ink-tertiary">Loading…</div>;
  }

  const message = contact.messages[activeType];

  return (
    <div className="px-10 py-9 max-w-[1120px]">
      <Link href="/networking" className="text-[12.5px] text-ink-tertiary block mb-4 no-underline">
        ← All contacts
      </Link>
      <div className="font-mono text-[11px] tracking-wide text-ink-quaternary uppercase">
        {contact.company ?? "Unknown company"} · Outreach
      </div>
      <h1 className="font-serif text-[34px] font-normal mt-1.5">Reach {contact.name.split(" ")[0]}</h1>
      <p className="text-[15px] text-ink-secondary mt-1.5 max-w-[660px]">
        The agent drafts. You send from your own LinkedIn account or email — copy the message
        across, or open the profile and paste. No automation touches their inbox.
      </p>

      <div className="grid grid-cols-[300px_1fr] gap-4.5 mt-6 items-start">
        <div className="flex flex-col gap-3">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-black/[0.06] flex items-center justify-center text-[14px] font-semibold text-ink-tertiary">
                {initials(contact.name)}
              </div>
              <div>
                <div className="text-[14.5px] font-semibold">{contact.name}</div>
                <div className="text-[12.5px] text-ink-secondary">
                  {contact.role ?? CONTACT_TYPE_LABELS[contact.contactType as ContactType]}
                  {contact.company ? `, ${contact.company}` : ""}
                </div>
              </div>
            </div>
            <div className="mt-3.5">
              <StaticPill tone={contact.source === "PROVIDER_VERIFIED" ? "success" : "default"}>
                {contact.source === "PROVIDER_VERIFIED"
                  ? "Verified by provider"
                  : "You supplied this contact · unverified"}
              </StaticPill>
            </div>
            {contact.relationshipNote ? (
              <div className="text-[12.5px] text-ink-secondary mt-3 leading-relaxed">
                {contact.relationshipNote}
              </div>
            ) : null}
            {contact.profileUrl ? (
              <a href={contact.profileUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full mt-3.5">
                  Open LinkedIn profile
                </Button>
              </a>
            ) : null}
          </Card>
        </div>

        <div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {OUTREACH_MESSAGE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className="rounded-pill border px-3.5 py-1.5 text-[12.5px] cursor-pointer"
                style={{
                  borderColor: activeType === type ? "transparent" : "#D8D2C4",
                  background: activeType === type ? "#1B1A17" : "#FFFDF9",
                  color: activeType === type ? "#F6F3EA" : "#4A473E",
                }}
              >
                {OUTREACH_MESSAGE_TYPE_LABELS[type]}
                {contact.messages[type] ? " ✓" : ""}
              </button>
            ))}
          </div>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-3.5">
              <span className="text-[13px] font-semibold">{OUTREACH_MESSAGE_TYPE_LABELS[activeType]}</span>
              {message ? (
                <StaticPill tone={message.status === "SENT" ? "success" : "default"}>
                  {message.status === "SENT" ? "Sent" : "Draft"}
                </StaticPill>
              ) : null}
            </div>

            {!message ? (
              <div>
                <div className="text-[13.5px] text-ink-tertiary mb-3.5">No draft yet for this message type.</div>
                <Button variant="primary" disabled={busy} onClick={() => generate(false)}>
                  {busy ? "Generating…" : "Generate draft"}
                </Button>
                {generateError ? (
                  <div className="text-[12.5px] text-accent-risk-text mt-2.5">
                    {generateError}{" "}
                    {upgradeRequired ? (
                      <Link href="/settings" className="underline">
                        Upgrade to Pro
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className="w-full max-w-[600px] text-[14.5px] leading-relaxed border border-border-strong rounded-btn p-3 font-sans"
              />
            ) : (
              <div className="text-[14.5px] leading-relaxed text-ink-primary whitespace-pre-line max-w-[600px]">
                {message.content}
              </div>
            )}

            {message ? (
              <>
                <div className="flex gap-2 mt-5 flex-wrap">
                  {editing ? (
                    <Button variant="primary" disabled={busy} onClick={saveEdit}>
                      Save edit
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={busy}
                      onClick={() => navigator.clipboard?.writeText(message.content)}
                    >
                      Copy message
                    </Button>
                  )}
                  <Button variant="secondary" disabled={busy} onClick={() => setEditing((v) => !v)}>
                    {editing ? "Cancel" : "Edit draft"}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => generate(true)}>
                    Regenerate
                  </Button>
                  <Button variant="secondary" disabled={busy || message.status === "SENT"} onClick={markSent}>
                    {message.status === "SENT" ? "Marked as sent" : "Mark as sent"}
                  </Button>
                </div>
                {generateError ? (
                  <div className="text-[12.5px] text-accent-risk-text mt-2.5">
                    {generateError}{" "}
                    {upgradeRequired ? (
                      <Link href="/settings" className="underline">
                        Upgrade to Pro
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4.5 pt-3.5 border-t border-[#F0ECE1] text-[12px] text-ink-tertiary leading-relaxed">
                  {message.citedEntityIds.length > 0
                    ? `Grounded in ${message.citedEntityIds.length} verified profile ${message.citedEntityIds.length === 1 ? "entry" : "entries"}.`
                    : "No specific profile evidence was cited."}
                </div>
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
