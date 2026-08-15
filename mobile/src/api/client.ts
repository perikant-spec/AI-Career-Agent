import { Platform } from "react-native";

// Points at the same Next.js backend the web app uses — this is the "shared backend" contract.
// localhost works for the Expo *web* target (same machine, same browser) and for an iOS
// Simulator, but a physical device or Android emulator can't reach a dev machine's "localhost" —
// it needs the machine's LAN IP instead (a well-known Expo dev-workflow constraint, not
// something this app's code can paper over). Override via EXPO_PUBLIC_API_URL for that case.
const DEFAULT_API_URL =
  Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status);
  }

  return json as T;
}
