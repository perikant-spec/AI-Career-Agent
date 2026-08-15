import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// SecureStore wraps the iOS Keychain / Android Keystore — neither exists in a browser, so the
// Expo web target (used for this project's own verification, since no iOS/Android simulator is
// available in this environment) falls back to localStorage. Native builds always use SecureStore.
const KEY = "career-agent-mobile-token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  }
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
