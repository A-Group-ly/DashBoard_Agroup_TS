import { memo, useMemo, useState } from "react";
import { ChartColumn, ChartLine, ChartPie, Users } from "lucide-react";

import type { Currency, DashboardSummary, SubscriptionStatus } from "../../../shared/types";
import { BarChart } from "./BarChart";
import { DonutChart, type DonutSlice } from "./DonutChart";
import { LineChart } from "./LineChart";

type Tab = "trend" | "profit" | "mix" | "subscriptions";

const TABS: { id: Tab; label: string; icon: typeof ChartLine; finance: boolean }[] = [
  { id: "trend", label: "Revenue & expenses", icon: ChartLine, finance: true },
  { id: "profit", label: "Net profit", icon: ChartColumn, finance: true },
  { id: "mix", label: "Revenue mix", icon: ChartPie, finance: true },
  { id: "subscriptions", label: "Subscriptions", icon: Users, finance: false },
];

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

const STATUS: { id: SubscriptionStatus; label: string; color: string }[] = [
  { id: "ACTIVE", label: "Active", color: "var(--status-active)" },
  { id: "PENDING", label: "Pending", color: "var(--status-pending)" },
  { id: "CANCELLED", label: "Cancelled", color: "var(--status-cancelled)" },
  { id: "EXPIRED", label: "Expired", color: "var(--status-expired)" },
];

const UNIT_WORD: Record<DashboardSummary["bucketUnit"], string> = {
  day: "day",
  week: "week",
  month: "month",
  quarter: "quarter",
  half: "half-year",
};

/**
 * One place for every chart, organised in tabs so the page stays short and
 * every chart has the same frame, legend and hover behaviour.
 */
export const ChartsSection = memo(function ChartsSection({
  summary,
  currency,
}: {
  summary: DashboardSummary;
  currency: Currency;
}) {
  const finance = summary.finance;
  const tabs = TABS.filter((tab) => !tab.finance || finance);
  const [selected, setSelected] = useState<Tab>(tabs[0].id);
  const tab = tabs.some((item) => item.id === selected) ? selected : tabs[0].id;

  const formatMoney = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (value: number) =>
      currency === "LYD" ? `${formatter.format(value)} LYD` : `$${formatter.format(value)}`;
  }, [currency]);
  const formatCount = (value: number) => value.toLocaleString("en-US");

  const labels = (finance?.history ?? summary.subscriptions.history).map((point) => point.label);
  const caption = `By ${UNIT_WORD[summary.bucketUnit]} · ${currency === "LYD" ? "Libyan dinar" : "US dollar"}`;

  return (
    <section aria-labelledby="charts-heading" className="rounded-2xl border border-slate-300 bg-slate-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-300 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="charts-heading" className="font-display text-lg font-bold text-slate-900">
            Charts
          </h2>
          <p className="text-sm text-slate-600">
            {tab === "mix" ? `${summary.range.current.label} · ${currency}` : tab === "subscriptions" ? `By ${UNIT_WORD[summary.bucketUnit]}` : caption}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Chart type"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0"
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  active
                    ? "border-slate-700 bg-slate-700 text-white"
                    : "border-slate-300 bg-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-300 hover:text-slate-900"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="fade-in p-4 sm:p-6" key={`${tab}-${currency}`}>
        {tab === "trend" && finance && (
          <LineChart
            ariaLabel={`Revenue and expenses in ${currency}`}
            labels={labels}
            format={formatMoney}
            series={[
              {
                id: "revenue",
                label: "Payments received",
                color: SERIES_COLORS[0],
                values: finance.history.map((point) => Number(point.revenue[currency])),
              },
              {
                id: "expenses",
                label: "Expenses",
                color: SERIES_COLORS[1],
                values: finance.history.map((point) => Number(point.expenses[currency])),
              },
            ]}
          />
        )}

        {tab === "profit" && finance && (
          <BarChart
            ariaLabel={`Net profit in ${currency}`}
            labels={labels}
            values={finance.history.map((point) => Number(point.netProfit[currency]))}
            format={formatMoney}
            seriesLabel="Net profit"
            signed
          />
        )}

        {tab === "mix" && finance && (
          <div className="grid gap-8 lg:grid-cols-2">
            <DonutChart
              title="By payment method"
              centerLabel="Total"
              format={formatMoney}
              slices={toSlices(finance.breakdown.byMethod, currency)}
            />
            <DonutChart
              title="By plan"
              centerLabel="Total"
              format={formatMoney}
              slices={toSlices(finance.breakdown.byPlan, currency)}
            />
          </div>
        )}

        {tab === "subscriptions" && (
          <div className="grid gap-8 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">New subscriptions</h3>
              <BarChart
                ariaLabel="New subscriptions per period"
                labels={summary.subscriptions.history.map((point) => point.label)}
                values={summary.subscriptions.history.map((point) => point.newSubscriptions)}
                format={formatCount}
                seriesLabel="New subscriptions"
              />
            </div>
            <div className="min-w-0 xl:col-span-2">
            <DonutChart
              title="All subscriptions by status"
              centerLabel="Total"
              format={formatCount}
              slices={STATUS.map((status) => ({
                id: status.id,
                label: status.label,
                color: status.color,
                value: summary.subscriptions.statusBreakdown[status.id],
              }))}
            />
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

function toSlices(
  items: NonNullable<DashboardSummary["finance"]>["breakdown"]["byMethod"],
  currency: Currency,
): DonutSlice[] {
  // Colour follows the entity (a fixed order by id), never its rank, so a
  // method keeps its colour when you switch currency or date range.
  const known = ["CASH", "LOCAL_BANK_CARD", "INTERNATIONAL_CARD"];
  const ids = items.map((item) => item.id);
  const colorOrder = ids.every((id) => known.includes(id)) ? known : [...ids].sort();
  return items
    .map((item) => ({ item, value: Number(item.amount[currency]) }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value)
    .map(({ item, value }) => ({
      id: item.id,
      label: item.label,
      value,
      color: SERIES_COLORS[colorOrder.indexOf(item.id)] ?? "var(--chart-axis)",
    }));
}
