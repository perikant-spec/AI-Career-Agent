import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { apiFetch } from "./client";

export function useApiQuery<T>(path: string | null) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!path || !token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path, { token });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [path, token]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
