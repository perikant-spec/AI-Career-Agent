import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

// Hard-guarded regardless of how this route is reached — EmailLog rows include live password
// reset links, so this must never render outside development, auth or no auth on the route.
export default async function DevOutboxPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const emails = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div className="min-h-screen bg-bg p-10 max-w-[720px] mx-auto">
      <h1 className="font-serif text-[30px]">Dev outbox</h1>
      <p className="text-[13.5px] text-ink-secondary mt-1.5 mb-6">
        No email service is configured in this environment — every email the app &ldquo;sends&rdquo; lands
        here instead. This route is hard-disabled in production builds.
      </p>

      {emails.length === 0 ? (
        <div className="text-[13.5px] text-ink-tertiary">Nothing sent yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {emails.map((email) => {
            const link = extractFirstUrl(email.text);
            return (
              <Card key={email.id} className="p-4">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-[13.5px] font-semibold">{email.subject}</span>
                  <span className="text-[11px] text-ink-quaternary font-mono">
                    {new Date(email.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[12px] text-ink-tertiary mt-1">to: {email.to}</div>
                <div className="text-[13px] text-ink-secondary mt-2.5 whitespace-pre-line leading-relaxed">
                  {email.text}
                </div>
                {link ? (
                  <a href={link} className="text-[12.5px] block mt-2.5">
                    Open link →
                  </a>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
