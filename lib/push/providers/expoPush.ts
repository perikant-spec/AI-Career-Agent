import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { prisma } from "@/lib/prisma";
import type { PushMessage, PushProvider } from "../types";

/**
 * A real implementation, not a swap-point stub -- unlike email (which needed a paid provider
 * account this environment doesn't have), Expo's push service is free and needs only the
 * recipient's Expo push token, so there's no reason for the default to stay console-only.
 *
 * Handles: dropping (not throwing on) malformed tokens, the 100-message-per-request chunk limit,
 * and cleaning up tokens Expo reports as dead. Ticket-level errors only -- a token that's
 * immediately rejected (e.g. malformed, already unregistered) shows up directly on its ticket.
 * Full receipt-based delivery confirmation (polling getPushNotificationReceiptsAsync some minutes
 * after send, for failures that only surface after Expo hands the message to Apple/Google) is a
 * known, deliberate gap -- it needs a second, delayed job this feature doesn't build yet.
 */
class ExpoPushProvider implements PushProvider {
  readonly name = "expo";
  private client = new Expo();

  async sendPush(messages: PushMessage[]): Promise<void> {
    const valid: ExpoPushMessage[] = [];
    for (const m of messages) {
      if (!Expo.isExpoPushToken(m.to)) {
        console.warn(`[push:expo] dropping malformed push token: ${m.to}`);
        continue;
      }
      valid.push({ to: m.to, title: m.title, body: m.body, data: m.data });
    }
    if (valid.length === 0) return;

    const chunks = this.client.chunkPushNotifications(valid);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      tickets.push(...(await this.client.sendPushNotificationsAsync(chunk)));
    }

    const deadTokens = tickets
      .map((ticket, i) => ({ ticket, token: valid[i]?.to }))
      .filter(({ ticket }) => ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered")
      .map(({ token }) => token)
      .filter((token): token is string => typeof token === "string");

    if (deadTokens.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: deadTokens } } });
    }
  }
}

export const expoPushProvider: PushProvider = new ExpoPushProvider();
