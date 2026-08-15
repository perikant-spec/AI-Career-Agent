import type { MailProvider } from "./types";
import { consoleMailProvider } from "./providers/console";

// The only branch point — no call site anywhere else checks which provider is active. No real
// provider is wired in yet (no API key present in this environment); this is the swap point for
// one later (e.g. `if (process.env.RESEND_API_KEY) return resendProvider;`).
export function getMailProvider(): MailProvider {
  return consoleMailProvider;
}
