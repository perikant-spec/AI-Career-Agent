import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Same platform-branch shape as auth/tokenStorage.ts -- stores the registered Expo push token
// locally so the Settings toggle can unregister the exact token it registered, not just flip a
// boolean with nothing to send the DELETE for.
const KEY = "career-agent-push-token";

export async function getStoredPushToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  }
  return SecureStore.getItemAsync(KEY);
}

export async function setStoredPushToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearStoredPushToken(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
