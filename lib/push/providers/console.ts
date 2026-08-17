import { prisma } from "@/lib/prisma";
import type { PushMessage, PushProvider } from "../types";

/**
 * Used when EXPO_PUSH_DISABLED=true (local dev/tests) so no real device push call happens. Mirrors
 * lib/mail/providers/console.ts's role exactly: logs + writes a PushLog row so a test/dev session
 * can assert what would have been sent, without ever hitting Expo's real push service.
 */
class ConsolePushProvider implements PushProvider {
  readonly name = "console";

  async sendPush(messages: PushMessage[]): Promise<void> {
    for (const message of messages) {
      console.log(`[push:console] to=${message.to} title="${message.title}"\n${message.body}`);
    }
    await prisma.pushLog.createMany({
      data: messages.map((m) => ({ to: m.to, title: m.title, body: m.body })),
    });
  }
}

export const consolePushProvider: PushProvider = new ConsolePushProvider();
