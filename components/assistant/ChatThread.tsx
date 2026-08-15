export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ChatThread({ messages, pending }: { messages: ChatMessage[]; pending: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[70%] bg-sidebar text-sidebar-text px-4 py-2.5 rounded-[14px] rounded-br-[4px] text-[14.5px]">
              {m.content}
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3 max-w-[760px]">
            <div className="w-[26px] h-[26px] flex-none rounded-lg bg-accent-teal flex items-center justify-center text-[12px] font-bold text-accent-teal-ink">
              A
            </div>
            <div className="flex-1 min-w-0 text-[14.5px] leading-relaxed text-ink-primary whitespace-pre-line">
              {m.content}
            </div>
          </div>
        )
      )}
      {pending ? (
        <div className="flex gap-3 items-center">
          <div className="w-[26px] h-[26px] flex-none rounded-lg bg-accent-teal" />
          <div className="flex gap-1.5 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-quaternary animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-quaternary animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-quaternary animate-pulse [animation-delay:300ms]" />
            <span className="text-[12.5px] text-ink-tertiary ml-1.5">checking your data…</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
