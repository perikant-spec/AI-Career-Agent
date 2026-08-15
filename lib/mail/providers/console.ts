import { prisma } from "@/lib/prisma";
import type { MailMessage, MailProvider } from "../types";

/**
 * No SMTP/Resend/SES credentials exist in this environment, so this is what actually sends mail
 * today: logs to the server console and writes an EmailLog row so the message (including any
 * reset link) can be viewed at /dev/outbox — a real, working default rather than a silent no-op,
 * exactly like the AI provider's mock. Swap in a real provider by setting an API key env var and
 * adding a branch to lib/mail/index.ts#getMailProvider; nothing else changes.
 */
class ConsoleMailProvider implements MailProvider {
  readonly name = "console";

  async sendMail(message: MailMessage): Promise<void> {
    console.log(`[mail:console] to=${message.to} subject="${message.subject}"\n${message.text}`);
    await prisma.emailLog.create({ data: message });
  }
}

export const consoleMailProvider: MailProvider = new ConsoleMailProvider();
