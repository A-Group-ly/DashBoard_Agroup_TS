import { useCallback, useState } from "react";
import { CircleCheck, Download, LoaderCircle, Lock, RefreshCw, TriangleAlert, Tv } from "lucide-react";

import { can } from "../../shared/permissions";
import type { Currency, CurrentUser, DashboardSummary } from "../../shared/types";
import { RecentSubscriptions } from "../components/cards";
import { ChartsSection } from "../components/charts/ChartsSection";
import { FinanceOverview, SubscriptionKpis } from "../components/overview";
import { PeriodPicker } from "../components/PeriodPicker";
import { daysAgo, todayLocal } from "../lib/dates";
import { navigate } from "../lib/router";
import { COMPANY_TIME_ZONE } from "../lib/format";
import { useDashboardSummary, type DashboardFilter } from "../lib/useDashboardSummary";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: COMPANY_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export function DashboardPage({ user }: { user: CurrentUser }) {
  const [filter, setFilter] = useState<DashboardFilter>(() => ({
    period: "month",
    from: daysAgo(29),
    to: todayLocal(),
  }));
  const [currency, setCurrency] = useState<Currency>("LYD");
  const { data: summary, isStale, loading, error, updatedAt, refresh } = useDashboardSummary(filter, user.id);
  const canExport = can(user.role, "finance:export");
  const finance = summary?.finance ?? null;

  const onFilterChange = useCallback((next: DashboardFilter) => setFilter(next), []);

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Filters: one row above everything they control */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <PeriodPicker value={filter} onChange={onFilterChange} />

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {finance && (
            <div role="radiogroup" aria-label="Currency" className="flex rounded-xl border border-slate-300 bg-slate-200 p-1">
              {(["LYD", "USD"] as Currency[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={currency === option}
                  onClick={() => setCurrency(option)}
                  className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${
                    currency === option ? "bg-slate-700 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300 hover:text-slate-900"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/tv")}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-4 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-300"
            title="Show a full-screen wallboard for an office TV"
          >
            <Tv size={17} />
            <span className="hidden sm:inline">TV mode</span>
            <span className="sr-only sm:hidden">TV mode</span>
          </button>

          {canExport && (
            <button
              type="button"
              onClick={() => summary && exportCsv(summary)}
              disabled={!summary?.finance}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Export CSV"
            >
              <Download size={17} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Refresh now"
            title="Refresh now"
            onClick={refresh}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-300"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* What is being compared, and freshness */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
            {summary?.title ?? "Loading..."}
          </h1>
          {summary && (
            <p className="mt-0.5 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{summary.range.current.label}</span>
              {summary.range.isToDate && " (so far)"} compared with{" "}
              <span className="font-semibold text-slate-800">{summary.range.previous.label}</span>
              {summary.range.isToDate && summary.period !== "custom" && " (same point)"}
            </p>
          )}
        </div>

        <div
          className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium sm:self-auto ${
            error
              ? "border-rose-300 bg-rose-100 text-rose-800"
              : loading
                ? "border-slate-300 bg-slate-200 text-slate-700"
                : "border-emerald-300 bg-emerald-100 text-emerald-800"
          }`}
        >
          {error ? <TriangleAlert size={14} /> : loading ? <LoaderCircle size={14} className="animate-spin" /> : <CircleCheck size={14} />}
          {error
            ? "Could not refresh"
            : loading
              ? "Updating..."
              : `Live · updated ${updatedAt ? timeFormat.format(updatedAt) : ""} · refreshes every minute`}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-100 p-4 text-sm text-rose-800">
          <p className="font-semibold">Could not load the figures.</p>
          <p className="mt-1">{error}</p>
          <button type="button" onClick={refresh} className="mt-3 rounded-lg border border-rose-400 px-3 py-2 font-medium hover:bg-rose-200">
            Retry
          </button>
        </div>
      )}

      {!summary ? (
        loading && <LoadingSkeleton />
      ) : (
        <div className={`space-y-5 transition-opacity duration-200 sm:space-y-7 ${isStale ? "opacity-60" : ""}`} aria-busy={isStale}>
          {finance ? (
            <FinanceOverview finance={finance} currency={currency} periodLabel={summary.range.current.label} />
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-400 bg-slate-100 p-4 text-sm text-slate-600">
              <Lock size={18} className="mt-0.5 shrink-0 text-slate-500" />
              <p>
                <strong className="text-slate-800">Financial figures are hidden for your role.</strong> Revenue, expenses,
                profit and debts need the Finance or Super admin role.
              </p>
            </div>
          )}

          <SubscriptionKpis subscriptions={summary.subscriptions} />

          <ChartsSection summary={summary} currency={currency} />

          <RecentSubscriptions items={summary.recentSubscriptions} />
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-48 animate-pulse rounded-2xl border border-slate-300 bg-slate-200" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-slate-300 bg-slate-200" />
    </div>
  );
}

function exportCsv(summary: DashboardSummary) {
  const finance = summary.finance;
  if (!finance) return;

  const { current, previous, obligations, dueByMonthEnd } = finance;
  const subs = summary.subscriptions;
  const rows: (string | number)[][] = [
    ["A-Group financial overview", summary.range.current.label, `vs ${summary.range.previous.label}`, ""],
    ["Metric", "Current period", "Previous period", "Currency"],
    ["New subscriptions", subs.current.newSubscriptions, subs.previous.newSubscriptions, "Count"],
    ["Paid subscriptions", subs.current.paidSubscriptions, subs.previous.paidSubscriptions, "Count"],
    ...(["LYD", "USD"] as const).flatMap((c) => [
      ["Total paid", current.paymentsReceived[c], previous.paymentsReceived[c], c],
      ["Expenses", current.expenses[c], previous.expenses[c], c],
      ["Net profit / loss", current.netProfit[c], previous.netProfit[c], c],
    ]),
    [],
    ["As of today", "Amount", "", "Currency"],
    ...(["LYD", "USD"] as const).flatMap((c) => [
      ["Outstanding debts (payables)", obligations.payables.remaining[c], "", c],
      ["Customers still owe", obligations.receivables.remaining[c], "", c],
      [`Renewals due by ${dueByMonthEnd.label}`, dueByMonthEnd.renewals.amount[c], "", c],
      [`Bills due by ${dueByMonthEnd.label}`, dueByMonthEnd.bills.amount[c], "", c],
    ]),
    [],
    ["Period", "Payments LYD", "Expenses LYD", "Net LYD", "Payments USD", "Expenses USD", "Net USD"],
    ...finance.history.map((point) => [
      point.key,
      point.revenue.LYD,
      point.expenses.LYD,
      point.netProfit.LYD,
      point.revenue.USD,
      point.expenses.USD,
      point.netProfit.USD,
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `a-group-financial-overview-${summary.period}-${summary.range.current.from.slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
