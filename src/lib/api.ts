import { useAuth } from "@clerk/react";
import { useCallback } from "react";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Returns a fetch helper for our own /api routes. Every call attaches the
 * current Clerk session token, which the worker verifies before answering.
 */
export function useApi() {
  const { getToken } = useAuth();

  return useCallback(
    async <T>(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<T> => {
      const token = await getToken();
      if (!token) {
        throw new ApiRequestError(401, "unauthenticated", "Your session has ended. Please sign in again.");
      }

      const response = await fetch(path, {
        ...init,
        cache: "no-store",
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await response.json().catch(() => null)) as
        | (T & { error?: string; message?: string })
        | null;

      if (!response.ok) {
        throw new ApiRequestError(
          response.status,
          body?.error ?? "request_failed",
          body?.message ?? `Request failed (${response.status})`,
        );
      }

      return body as T;
    },
    [getToken],
  );
}
