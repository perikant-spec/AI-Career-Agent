export interface PushMessage {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushProvider {
  readonly name: string;
  sendPush(messages: PushMessage[]): Promise<void>;
}
