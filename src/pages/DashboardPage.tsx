import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CircleCheck,
  CreditCard,
  Download,
  LoaderCircle,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { can } from "../../shared/permissions";
import type { Currency, CurrentUser, DashboardSummary, Period } from "../../shared/types";
import {
  FinanceLockedCard,
  MiniStat,
  PayablesCard,
  ProfitCard,
  RecentSubscriptions,
  StatusBreakdown,
  SubscriptionCard,
} from "../components/cards";
import { ProfitChart } from "../components/ProfitChart";
import { useApi } from "../lib/api";
import { COMPANY_TIME_ZONE, money } from "../lib/format";

const REFRESH_INTERVAL_SECONDS = 60;

export function DashboardPage({ user }: { user: CurrentUser }) {
  const api = useApi();
  const [period, setPeriod] = useState<Period>("monthly");
  const [currency, setCurrency] = useState<Currency>("LYD");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [clock, setClock] = useState<Date>(() => new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL_SECONDS);
  const countdownRef = useRef(REFRESH_INTERVAL_SECONDS);

  const canExport = can(user.role, "finance:export");

  // Auto-refresh every 60 seconds, with a visible countdown.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date());
      const next = countdownRef.current - 1;
      if (next <= 0) {
        countdownRef.current = REFRESH_INTERVAL_SECONDS;
        setSecondsUntilRefresh(REFRESH_INTERVAL_SECONDS);
        setReloadKey((value) => value + 1);
      } else {
        countdownRef.current = next;
        setSecondsUntilRefresh(next);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const result = await api<DashboardSummary>(`/api/dashboard/summary?period=${period}`, {
          signal: controller.signal,
        });
        setSummary(result);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [api, period, reloadKey]);

  function resetCountdown() {
    countdownRef.current = REFRESH_INTERVAL_SECONDS;
    setSecondsUntilRefresh(REFRESH_INTERVAL_SECONDS);
    setClock(new Date());
  }

  function refreshNow() {
    resetCountdown();
    setReloadKey((value) => value + 1);
  }

  function selectPeriod(option: Period) {
    setPeriod(option);
    resetCountdown();
  }

  const countdownLabel = `${String(Math.floor(secondsUntilRefresh / 60)).padStart(2, "0")}:${String(
    secondsUntilRefresh % 60,
  ).padStart(2, "0")}`;

  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(clock);

  const finance = summary?.finance ?? null;
  const subs = summary?.subscriptions;

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-display text-base font-bold text-slate-900 sm:text-lg">
            {summary?.range.current.label ?? "Loading..."}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {currentDateLabel} · Tripoli time
            {summary && ` · compared with ${summary.range.previous.label}`}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <div className="flex rounded-xl border border-slate-300 bg-slate-200 p-1">
            {(["monthly", "weekly"] as Period[]).map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => selectPeriod(option)}
                aria-pressed={period === option}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                  period === option ? "bg-slate-700 text-white" : "text-slate-700 hover:bg-slate-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div
            className="hidden items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-3 py-2.5 text-xs font-semibold tabular-nums text-slate-700 sm:flex"
            title="The dashboard refreshes every 60 seconds."
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh in {countdownLabel}
          </div>

          {canExport && (
            <button
              type="button"
              onClick={() => summary && exportCsv(summary)}
              disabled={!summary?.finance}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Export CSV"
            >
              <Download size={17} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Refresh dashboard now"
            onClick={refreshNow}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-slate-700 transition hover:bg-slate-300"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
          error
            ? "border-rose-300 bg-rose-100 text-rose-800"
            : loading
              ? "border-slate-300 bg-slate-200 text-slate-700"
              : "border-emerald-300 bg-emerald-100 text-emerald-800"
        }`}
      >
        {error ? (
          <Activity size={14} />
        ) : loading ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <CircleCheck size={14} />
        )}
        {error ? "Could not refresh" : loading ? "Updating figures..." : "Live data · Neon Postgres"}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-100 p-4 text-sm text-rose-800">
          <p className="font-semibold">Could not load financial information.</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={refreshNow}
            className="mt-3 rounded-lg border border-rose-400 px-3 py-2 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !summary ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-300 bg-slate-100">
          <div className="flex items-center gap-3 text-slate-600">
            <LoaderCircle className="animate-spin" />
            Loading A-Group financial data...
          </div>
        </div>
      ) : summary && subs ? (
        <>
          <section className="grid items-stretch gap-5 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-5">
              <SubscriptionCard
                count={subs.current.newSubscriptions}
                paidCount={subs.current.paidSubscriptions}
                change={subs.change.newSubscriptions}
              />
              {finance ? (
                <ProfitCard
                  currency={currency}
                  setCurrency={setCurrency}
                  currentProfit={finance.current.netProfit[currency]}
                  previousProfit={finance.previous.netProfit[currency]}
                  change={currency === "LYD" ? finance.change.profitLYD : finance.change.profitUSD}
                />
              ) : (
                <StatusBreakdown counts={subs.statusBreakdown} />
              )}
            </div>

            <div className="min-w-0">
              {finance ? (
                <ProfitChart
                  points={finance.history}
                  currency={currency}
                  periodWord={period === "monthly" ? "months" : "weeks"}
                />
              ) : (
                <FinanceLockedCard />
              )}
            </div>
          </section>

          {finance && (
            <section>
              <div className="mb-4">
                <h2 className="font-display text-lg font-bold text-slate-900">Financial snapshot</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Received payments and expenses this period, separated by currency.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                <MiniStat
                  label="Payments received · LYD"
                  value={money(finance.current.paymentsReceived.LYD, "LYD")}
                  icon={Wallet}
                />
                <MiniStat
                  label="Payments received · USD"
                  value={money(finance.current.paymentsReceived.USD, "USD")}
                  icon={CreditCard}
                />
                <MiniStat label="Expenses · LYD" value={money(finance.current.expenses.LYD, "LYD")} icon={Receipt} />
                <MiniStat label="Expenses · USD" value={money(finance.current.expenses.USD, "USD")} icon={Receipt} />
              </div>
            </section>
          )}

          <section className={`grid gap-5 ${finance ? "lg:grid-cols-3" : ""}`}>
            <div className={finance ? "min-w-0 lg:col-span-2" : "min-w-0"}>
              <RecentSubscriptions items={summary.recentSubscriptions} />
            </div>
            {finance && (
              <div className="min-w-0">
                <StatusBreakdown counts={subs.statusBreakdown} />
              </div>
            )}
          </section>

          {finance && <PayablesCard payables={finance.outstandingPayables} />}
        </>
      ) : null}
    </div>
  );
}

function exportCsv(summary: DashboardSummary) {
  const finance = summary.finance;
  if (!finance) return;

  const { current, previous } = finance;
  const subs = summary.subscriptions;
  const rows: (string | number)[][] = [
    ["A-Group financial overview", summary.range.current.label, `vs ${summary.range.previous.label}`, ""],
    ["Metric", "Current period", "Previous period", "Currency"],
    ["New subscriptions", subs.current.newSubscriptions, subs.previous.newSubscriptions, "Count"],
    ["Paid subscriptions", subs.current.paidSubscriptions, subs.previous.paidSubscriptions, "Count"],
    ["Payments received", current.paymentsReceived.LYD, previous.paymentsReceived.LYD, "LYD"],
    ["Payments received", current.paymentsReceived.USD, previous.paymentsReceived.USD, "USD"],
    ["Expenses", current.expenses.LYD, previous.expenses.LYD, "LYD"],
    ["Expenses", current.expenses.USD, previous.expenses.USD, "USD"],
    ["Net profit / loss", current.netProfit.LYD, previous.netProfit.LYD, "LYD"],
    ["Net profit / loss", current.netProfit.USD, previous.netProfit.USD, "USD"],
    ["Outstanding payables", finance.outstandingPayables.LYD, "", "LYD"],
    ["Outstanding payables", finance.outstandingPayables.USD, "", "USD"],
    [],
    ["Profit history", "Net profit LYD", "Net profit USD", ""],
    ...finance.history.map((point) => [point.key, point.netProfit.LYD, point.netProfit.USD, ""]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `a-group-financial-overview-${summary.period}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
