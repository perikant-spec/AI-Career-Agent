import type { PushProvider } from "./types";
import { expoPushProvider } from "./providers/expoPush";
import { consolePushProvider } from "./providers/console";

// Unlike getMailProvider(), which always defaults to console (no real email provider is wired
// in), this defaults straight to the real Expo provider -- Expo push needs no paid account to
// work for real. EXPO_PUSH_DISABLED is the explicit local-dev/test opt-out so unit/integration
// runs (and `npm run dev` without a physical device) never fire a real device push.
export function getPushProvider(): PushProvider {
  if (process.env.EXPO_PUSH_DISABLED === "true") return consolePushProvider;
  return expoPushProvider;
}
