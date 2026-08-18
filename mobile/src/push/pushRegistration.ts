import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { apiFetch } from "@/api/client";

// Mirrors tokenStorage.ts's platform-branch shape. Web has no real push capability (matches the
// "WEB is stored but never targeted" note in lib/push/providers/expoPush.ts on the backend) --
// this is a no-op there rather than attempting a permission prompt the browser can't honor the
// same way. Real push notifications also aren't deliverable in Expo Go on Android since SDK 53
// (a development build is required) and need a configured EAS projectId to mint a token at all --
// this app has never been built for a real device or submitted to EAS, so this registration path
// is structurally correct but not end-to-end verified beyond that boundary (same documented gap
// as the rest of this app's native-build limitation, see mobile/README).
export async function registerForDailyBriefing(
  authToken: string
): Promise<{ registered: boolean; pushToken?: string; reason?: string }> {
  if (Platform.OS === "web") return { registered: false, reason: "not_supported_on_web" };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    return { registered: false, reason: "permission_denied" };
  }

  try {
    // projectId omitted -- Notifications.getExpoPushTokenAsync resolves it internally from the
    // app config when unset.
    const pushToken = await Notifications.getExpoPushTokenAsync();
    await apiFetch("/api/push-tokens", {
      method: "POST",
      body: { token: pushToken.data, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" },
      token: authToken,
    });
    return { registered: true, pushToken: pushToken.data };
  } catch (err) {
    console.warn("[push] registration failed:", err);
    return { registered: false, reason: "token_unavailable" };
  }
}

export async function unregisterFromDailyBriefing(authToken: string, pushToken: string): Promise<void> {
  await apiFetch("/api/push-tokens", { method: "DELETE", body: { token: pushToken }, token: authToken });
}
