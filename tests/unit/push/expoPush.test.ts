import { describe, it, expect, vi, beforeEach } from "vitest";

const sendPushNotificationsAsyncMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushToken: { deleteMany: (...args: unknown[]) => deleteManyMock(...args) },
  },
}));

vi.mock("expo-server-sdk", () => {
  class MockExpo {
    static isExpoPushToken(token: unknown): boolean {
      return typeof token === "string" && token.startsWith("ExponentPushToken[");
    }
    chunkPushNotifications(messages: unknown[]): unknown[][] {
      const chunkSize = 100;
      const chunks: unknown[][] = [];
      for (let i = 0; i < messages.length; i += chunkSize) chunks.push(messages.slice(i, i + chunkSize));
      return chunks;
    }
    sendPushNotificationsAsync(...args: unknown[]) {
      return sendPushNotificationsAsyncMock(...args);
    }
  }
  return { Expo: MockExpo };
});

// Imported after the mocks above so the module under test picks up the mocked expo-server-sdk.
const { expoPushProvider } = await import("@/lib/push/providers/expoPush");

beforeEach(() => {
  sendPushNotificationsAsyncMock.mockReset();
  deleteManyMock.mockReset();
});

describe("expoPushProvider.sendPush", () => {
  it("drops malformed tokens without throwing, and never calls the send API with zero valid messages", async () => {
    sendPushNotificationsAsyncMock.mockResolvedValue([]);
    await expoPushProvider.sendPush([{ to: "not-a-real-token", title: "Hi", body: "Body" }]);
    expect(sendPushNotificationsAsyncMock).not.toHaveBeenCalled();
  });

  it("sends only the valid tokens, filtering out malformed ones from a mixed batch", async () => {
    sendPushNotificationsAsyncMock.mockResolvedValue([{ status: "ok", id: "receipt-1" }]);
    await expoPushProvider.sendPush([
      { to: "garbage", title: "Hi", body: "Body" },
      { to: "ExponentPushToken[valid]", title: "Hi", body: "Body" },
    ]);
    expect(sendPushNotificationsAsyncMock).toHaveBeenCalledTimes(1);
    const sentChunk = sendPushNotificationsAsyncMock.mock.calls[0][0];
    expect(sentChunk).toHaveLength(1);
    expect(sentChunk[0].to).toBe("ExponentPushToken[valid]");
  });

  it("splits more than 100 messages into multiple chunked send calls", async () => {
    sendPushNotificationsAsyncMock.mockResolvedValue([]);
    const messages = Array.from({ length: 150 }, (_, i) => ({
      to: `ExponentPushToken[t${i}]`,
      title: "Hi",
      body: "Body",
    }));
    await expoPushProvider.sendPush(messages);
    expect(sendPushNotificationsAsyncMock).toHaveBeenCalledTimes(2);
    expect(sendPushNotificationsAsyncMock.mock.calls[0][0]).toHaveLength(100);
    expect(sendPushNotificationsAsyncMock.mock.calls[1][0]).toHaveLength(50);
  });

  it("deletes the PushToken row for any token Expo reports as DeviceNotRegistered", async () => {
    sendPushNotificationsAsyncMock.mockResolvedValue([
      { status: "error", message: "not registered", details: { error: "DeviceNotRegistered", expoPushToken: "ExponentPushToken[dead]" } },
    ]);
    await expoPushProvider.sendPush([{ to: "ExponentPushToken[dead]", title: "Hi", body: "Body" }]);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { token: { in: ["ExponentPushToken[dead]"] } } });
  });

  it("does not touch PushToken for other error types (e.g. MessageRateExceeded)", async () => {
    sendPushNotificationsAsyncMock.mockResolvedValue([
      { status: "error", message: "rate limited", details: { error: "MessageRateExceeded", expoPushToken: "ExponentPushToken[a]" } },
    ]);
    await expoPushProvider.sendPush([{ to: "ExponentPushToken[a]", title: "Hi", body: "Body" }]);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });
});
