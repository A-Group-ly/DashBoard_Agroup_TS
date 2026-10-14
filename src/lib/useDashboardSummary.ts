import { useCallback, useEffect, useState } from "react";

import type { DashboardSummary, Period } from "../../shared/types";
import { useApi } from "./api";

export const REFRESH_INTERVAL_MS = 60_000;

export type DashboardFilter = { period: Period; from: string; to: string };

export function filterToQuery(filter: DashboardFilter): string {
  const params = new URLSearchParams({ period: filter.period });
  if (filter.period === "custom") {
    params.set("from", filter.from);
    params.set("to", filter.to);
  }
  return params.toString();
}

// Results per user + filter, kept for the life of the tab. Switching back to a
// filter you already opened shows its figures instantly while they refresh.
const cache = new Map<string, { data: DashboardSummary; at: number }>();

type State = {
  key: string;
  data: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
};

/**
 * Loads the dashboard summary and keeps it fresh:
 *  - refreshes every 60 s, but only while the tab is visible
 *  - catches up immediately when you come back to a stale tab
 *  - keeps showing the previous figures while new ones load (no blank flash)
 */
export function useDashboardSummary(filter: DashboardFilter, userId: string) {
  const api = useApi();
  const query = filterToQuery(filter);
  const key = `${userId}?${query}`;
  const [state, setState] = useState<State>({
    key: "",
    data: null,
    loading: true,
    error: null,
    updatedAt: null,
  });
  const [manualRefresh, setManualRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let lastLoad = 0;

    async function load() {
      window.clearTimeout(timer);
      lastLoad = Date.now();
      const cached = cache.get(key);
      setState((previous) => ({
        key,
        data: cached?.data ?? previous.data,
        loading: true,
        error: null,
        updatedAt: cached?.at ?? previous.updatedAt,
      }));

      try {
        const data = await api<DashboardSummary>(`/api/dashboard/summary?${query}`, {
          signal: controller.signal,
        });
        const at = Date.now();
        cache.set(key, { data, at });
        setState({ key, data, loading: false, error: null, updatedAt: at });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          error: err instanceof Error ? err.message : "Could not load the dashboard.",
        }));
      }

      if (!controller.signal.aborted) {
        timer = window.setTimeout(() => {
          if (!document.hidden) void load();
        }, REFRESH_INTERVAL_MS);
      }
    }

    const onVisibility = () => {
      if (!document.hidden && Date.now() - lastLoad >= REFRESH_INTERVAL_MS) void load();
    };

    document.addEventListener("visibilitychange", onVisibility);
    void load();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [api, key, query, manualRefresh]);

  const refresh = useCallback(() => setManualRefresh((value) => value + 1), []);

  return {
    data: state.data,
    // While the first response for a new filter is on its way, `data` is the
    // previous filter's result; `isStale` lets the UI dim it.
    isStale: state.key !== key || (state.loading && !cache.has(key)),
    loading: state.loading,
    error: state.error,
    updatedAt: state.updatedAt,
    refresh,
  };
}
