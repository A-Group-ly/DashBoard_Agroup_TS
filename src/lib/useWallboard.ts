import { useEffect, useState } from "react";

import type { WallboardSummary } from "../../shared/types";
import { ApiRequestError, useApi } from "./api";

type State = {
  data: WallboardSummary | null;
  lastSuccessAt: number | null;
  error: ApiRequestError | Error | null;
  loading: boolean;
};

const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Keeps the wallboard figures fresh.
 *  - one request at a time (never overlapping)
 *  - the next request is scheduled only after the previous one finishes
 *  - on failure the last good figures stay on screen, and retries back off
 *    (15 s, 30 s, 1 min … up to 5 min) so a broken API is not hammered
 *  - catches up immediately when the tab becomes visible again
 *  - timers and requests are cleaned up when TV mode closes
 */
export function useWallboard(intervalMs: number) {
  const api = useApi();
  const [state, setState] = useState<State>({ data: null, lastSuccessAt: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let inFlight = false;
    let failures = 0;
    let lastAttempt = 0;

    async function load() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      lastAttempt = Date.now();
      window.clearTimeout(timer);
      setState((previous) => ({ ...previous, loading: true }));

      try {
        const data = await api<WallboardSummary>("/api/wallboard", { signal: controller.signal });
        failures = 0;
        setState({ data, lastSuccessAt: Date.now(), error: null, loading: false });
      } catch (err) {
        if (controller.signal.aborted) return;
        failures += 1;
        setState((previous) => ({
          ...previous,
          loading: false,
          error: err instanceof Error ? err : new Error("Request failed"),
        }));
      } finally {
        inFlight = false;
      }

      if (controller.signal.aborted) return;
      const delay = failures === 0 ? intervalMs : Math.min(15_000 * 2 ** (failures - 1), Math.max(MAX_BACKOFF_MS, intervalMs));
      timer = window.setTimeout(() => {
        if (!document.hidden) void load();
      }, delay);
    }

    const onVisible = () => {
      if (!document.hidden && Date.now() - lastAttempt >= Math.min(intervalMs, 15_000)) void load();
    };
    const onOnline = () => void load();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    void load();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [api, intervalMs]);

  return state;
}

/** Re-renders the caller every `stepMs` (for clocks and "stale" checks). */
export function useNow(stepMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(timer);
  }, [stepMs]);
  return now;
}
