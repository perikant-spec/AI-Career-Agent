"use client";

import { useState } from "react";

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || disabled) return;
    onSend(draft.trim());
    setDraft("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2.5 bg-card border border-border-strong rounded-xl px-4 py-2.5"
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Ask me anything about your job search…"
        className="flex-1 bg-transparent outline-none text-[15px]"
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !draft.trim()}
        className="border-0 bg-sidebar text-sidebar-text rounded-btn px-4 py-2 text-[13.5px] font-medium cursor-pointer disabled:opacity-50"
      >
        Ask
      </button>
    </form>
  );
}
