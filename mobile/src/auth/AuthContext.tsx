import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiFetch } from "@/api/client";
import { getToken, setToken as persistToken, clearToken } from "./tokenStorage";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, acceptedLegal: boolean, name?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On launch: a stored token is re-validated (and the user re-fetched) via /me, rather than
  // trusted blindly — a token could be expired or revoked since the app last ran.
  useEffect(() => {
    (async () => {
      const stored = await getToken();
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const body = await apiFetch<{ user: AuthUser }>("/api/mobile/auth/me", { token: stored });
        setToken(stored);
        setUser(body.user);
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const body = await apiFetch<{ token: string; user: AuthUser }>("/api/mobile/auth/login", {
        method: "POST",
        body: { email, password },
      });
      await persistToken(body.token);
      setToken(body.token);
      setUser(body.user);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      return false;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, acceptedLegal: boolean, name?: string) => {
    setError(null);
    try {
      const body = await apiFetch<{ token: string; user: AuthUser }>("/api/mobile/auth/register", {
        method: "POST",
        body: { email, password, name, acceptedLegal },
      });
      await persistToken(body.token);
      setToken(body.token);
      setUser(body.user);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
