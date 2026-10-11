
import { useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CreditCard,
  Download,
  Landmark,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Settings,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type Period = "Monthly" | "Weekly";

type Metric = {
  id: string;
  title: string;
  value: string;
  change?: string;
  comparison?: string;
  note?: string;
  positive?: boolean;
  icon: LucideIcon;
  iconClass: string;
};

// DEMO DATA ONLY.
// These values will later come from the NestJS API and MySQL.
const monthlyData = {
  subscriptions: "128",
  subscriptionsChange: "+12.3%",

  paidSubscriptions: "117",
  paidSubscriptionsChange: "+10.4%",

  lydRevenue: "42,500 LYD",
  lydChange: "+8.4%",

  usdRevenue: "$8,250",
  usdChange: "−3.2%",

  payablesLYD: "6,400 LYD",
  payablesUSD: "$1,200 USD",

  expensesLYD: "18,200 LYD",
  profitLYD: "24,300 LYD",

  expensesUSD: "$2,100",
  profitUSD: "$6,150",
};

const weeklyData = {
  subscriptions: "31",
  subscriptionsChange: "+6.9%",

  paidSubscriptions: "27",
  paidSubscriptionsChange: "+8.0%",

  lydRevenue: "12,600 LYD",
  lydChange: "+14.2%",

  usdRevenue: "$2,450",
  usdChange: "+5.6%",

  payablesLYD: "6,400 LYD",
  payablesUSD: "$1,200 USD",

  expensesLYD: "5,100 LYD",
  profitLYD: "7,500 LYD",

  expensesUSD: "$700",
  profitUSD: "$1,750",
};

function isPositiveChange(change: string): boolean {
  return !change.startsWith("−") && !change.startsWith("-");
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;

  return (
    <article
      id={metric.id}
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {metric.title}
          </p>

          <h2 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {metric.value}
          </h2>
        </div>

        <div className={`rounded-xl p-3 ${metric.iconClass}`}>
          <Icon size={21} />
        </div>
      </div>

      {metric.change ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
          {metric.positive ? (
            <ArrowUpRight size={17} className="text-emerald-700" />
          ) : (
            <ArrowDownRight size={17} className="text-rose-700" />
          )}

          <span
            className={`font-semibold ${
              metric.positive ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {metric.change}
          </span>

          <span className="text-slate-500">
            {metric.comparison}
          </span>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{metric.note}</p>
      )}
    </article>
  );
}

function App() {
  const [period, setPeriod] = useState<Period>("Monthly");

  const data = period === "Monthly" ? monthlyData : weeklyData;

  const currentMonth = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const comparisonLabel =
    period === "Monthly" ? "vs. last month" : "vs. last week";

  // Main dashboard metrics
  const metrics: Metric[] = [
    {
      id: "subscriptions",
      title: "New Subscriptions",
      value: data.subscriptions,
      change: data.subscriptionsChange,
      comparison: comparisonLabel,
      positive: isPositiveChange(data.subscriptionsChange),
      icon: RefreshCw,
      iconClass: "bg-slate-100 text-slate-700",
    },
    {
      id: "revenue-lyd",
      title: "Payments Received · LYD",
      value: data.lydRevenue,
      change: data.lydChange,
      comparison: comparisonLabel,
      positive: isPositiveChange(data.lydChange),
      icon: Wallet,
      iconClass: "bg-emerald-50 text-emerald-800",
    },
    {
      id: "revenue-usd",
      title: "Payments Received · USD",
      value: data.usdRevenue,
      change: data.usdChange,
      comparison: comparisonLabel,
      positive: isPositiveChange(data.usdChange),
      icon: CreditCard,
      iconClass: "bg-slate-100 text-slate-700",
    },
    {
      id: "paid-subscriptions",
      title: "Paid Subscriptions",
      value: data.paidSubscriptions,
      change: data.paidSubscriptionsChange,
      comparison: comparisonLabel,
      positive: isPositiveChange(data.paidSubscriptionsChange),
      icon: Receipt,
      iconClass: "bg-emerald-50 text-emerald-800",
    },
  ];

  // Illustrative chart indexes only; not actual currency amounts.
  const monthLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (6 - index));

    return date.toLocaleDateString("en-US", {
      month: "short",
    });
  });

  const monthlyTrend = [
    { label: monthLabels[0], lyd: 40, usd: 32 },
    { label: monthLabels[1], lyd: 48, usd: 38 },
    { label: monthLabels[2], lyd: 44, usd: 36 },
    { label: monthLabels[3], lyd: 60, usd: 43 },
    { label: monthLabels[4], lyd: 55, usd: 46 },
    { label: monthLabels[5], lyd: 72, usd: 52 },
    { label: monthLabels[6], lyd: 88, usd: 60 },
  ];

  const weeklyTrend = [
    { label: "Mon", lyd: 42, usd: 32 },
    { label: "Tue", lyd: 58, usd: 45 },
    { label: "Wed", lyd: 48, usd: 40 },
    { label: "Thu", lyd: 74, usd: 48 },
    { label: "Fri", lyd: 62, usd: 56 },
    { label: "Sat", lyd: 83, usd: 63 },
    { label: "Sun", lyd: 68, usd: 49 },
  ];

  const trendData = period === "Monthly" ? monthlyTrend : weeklyTrend;

  function exportReport() {
    const rows = [
      ["Metric", "Value", "Reporting Period"],
      ["New Subscriptions", data.subscriptions, period],
      ["Paid Subscriptions", data.paidSubscriptions, period],
      ["Payments Received - LYD", data.lydRevenue, period],
      ["Payments Received - USD", data.usdRevenue, period],
      ["Outstanding Payables - LYD", data.payablesLYD, "Current balance"],
      ["Outstanding Payables - USD", data.payablesUSD, "Current balance"],
      ["Expenses - LYD", data.expensesLYD, period],
      ["Net Profit - LYD", data.profitLYD, period],
      ["Expenses - USD", data.expensesUSD, period],
      ["Net Profit - USD", data.profitUSD, period],
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${cell.replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `financial-overview-${period.toLowerCase()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  const navItems = [
    {
      label: "Overview",
      href: "#overview",
      icon: LayoutDashboard,
    },
    {
      label: "Subscriptions",
      href: "#subscriptions",
      icon: RefreshCw,
    },
    {
      label: "Revenue Trends",
      href: "#revenue-trends",
      icon: TrendingUp,
    },
    {
      label: "Profit & Loss",
      href: "#profit-loss",
      icon: Receipt,
    },
    {
      label: "Payables",
      href: "#payables",
      icon: Landmark,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col bg-[#171717] text-white lg:flex">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="rounded-xl bg-white p-2 text-[#171717]">
              <Activity size={23} />
            </div>

            <div>
              <p className="font-bold tracking-wide">
                COMPANY FINANCE
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Subscription Management
              </p>
            </div>
          </div>

          <div className="px-4 pt-8">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Workspace
            </p>

            <nav className="space-y-1">
              {navItems.map((item, index) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                      index === 0
                        ? "bg-white text-[#171717]"
                        : "text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={19} />
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-white/10 p-5">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
                <Settings size={18} />
              </div>

              <div>
                <p className="text-sm font-medium">Admin Workspace</p>
                <p className="text-xs text-slate-400">
                  Demo environment
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main id="overview" className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-5 px-5 py-6 sm:px-8 xl:flex-row xl:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>Workspace</span>
                  <span>/</span>
                  <span className="text-slate-800">Overview</span>
                </div>

                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Financial Overview
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Track subscriptions, payments and company finances.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                  {(["Monthly", "Weekly"] as Period[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => setPeriod(option)}
                      aria-pressed={period === option}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        period === option
                          ? "bg-[#171717] text-white"
                          : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <button
                  onClick={exportReport}
                  className="flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  <Download size={17} />
                  Export CSV
                </button>

                <button
                  type="button"
                  aria-label="Notifications"
                  className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50"
                >
                  <Bell size={18} />
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] space-y-7 px-5 py-7 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <CalendarDays size={18} className="text-slate-500" />
                {period === "Monthly" ? currentMonth : "Current Week"}
              </div>

              <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Demo data · Not connected to MySQL yet
              </div>
            </div>

            {/* Main KPIs */}
            <section
              id="subscriptions"
              className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
            >
              {metrics.map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
              ))}
            </section>

            {/* Revenue trend */}
            <section className="grid gap-6 xl:grid-cols-3">
              <article
                id="revenue-trends"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Revenue Trends</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {period === "Monthly"
                        ? "Monthly trend over the last 7 months"
                        : "Revenue trend across the week"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#0f766e]" />
                      LYD trend
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                      USD trend
                    </span>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex h-52 items-end justify-between gap-2 border-b border-slate-200 px-1 pb-2">
                    {trendData.map((point) => (
                      <div
                        key={point.label}
                        className="flex h-full min-w-0 flex-1 flex-col justify-end"
                      >
                        <div className="flex h-full items-end justify-center gap-1.5">
                          <div
                            title={`LYD trend index: ${point.lyd}`}
                            className="w-3 rounded-t-md bg-[#0f766e] transition-all sm:w-5"
                            style={{ height: `${point.lyd}%` }}
                          />
                          <div
                            title={`USD trend index: ${point.usd}`}
                            className="w-3 rounded-t-md bg-slate-300 transition-all sm:w-5"
                            style={{ height: `${point.usd}%` }}
                          />
                        </div>

                        <span className="mt-3 text-center text-xs text-slate-500">
                          {point.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Illustrative trend indexes only. LYD and USD are shown
                    separately and are not converted or added together.
                  </p>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">
                      Subscription Activity
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Selected period
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                    <Activity size={21} />
                  </div>
                </div>

                <div className="mt-7">
                  <p className="text-4xl font-bold tracking-tight">
                    {data.subscriptions}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    New subscriptions
                  </p>
                </div>

                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <TrendingUp size={17} className="text-emerald-700" />
                    Previous-period comparison
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {data.subscriptionsChange} compared with the previous{" "}
                    {period === "Monthly" ? "month" : "week"}.
                  </p>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-500">
                      Paid subscriptions
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {data.paidSubscriptions}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {data.paidSubscriptionsChange} {comparisonLabel}
                    </p>
                  </div>
                </div>
              </article>
            </section>

            {/* Profit and loss */}
            <section id="profit-loss">
              <div className="mb-4">
                <h2 className="text-xl font-bold">Profit &amp; Loss</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Revenue minus recorded expenses, shown separately by currency.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {[
                  {
                    currency: "LYD",
                    title: "Libyan Dinar",
                    revenue: data.lydRevenue,
                    expenses: data.expensesLYD,
                    profit: data.profitLYD,
                  },
                  {
                    currency: "USD",
                    title: "US Dollar",
                    revenue: data.usdRevenue,
                    expenses: data.expensesUSD,
                    profit: data.profitUSD,
                  },
                ].map((item) => (
                  <article
                    key={item.currency}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <p className="font-bold">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.currency} financial summary
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                        <Wallet size={21} />
                      </div>
                    </div>

                    <div className="space-y-4 pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-500">Revenue</span>
                        <span className="font-semibold">{item.revenue}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-500">Expenses</span>
                        <span className="font-semibold">{item.expenses}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <span className="text-sm font-semibold text-slate-700">
                          Net Profit / Loss
                        </span>
                        <span className="text-lg font-bold text-emerald-800">
                          {item.profit}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Company debts */}
            <section
              id="payables"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-50 p-3 text-amber-800">
                  <Landmark size={22} />
                </div>

                <div className="flex-1">
                  <h2 className="font-bold">
                    Company Outstanding Payables
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Unpaid bills and obligations the company owes to others.
                    These are separate from amounts customers owe the company.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">
                        Payables · LYD
                      </p>
                      <p className="mt-2 text-2xl font-bold">
                        {data.payablesLYD}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">
                        Payables · USD
                      </p>
                      <p className="mt-2 text-2xl font-bold">
                        {data.payablesUSD}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-xs leading-5 text-slate-500 sm:flex-row">
              <span>Subscription Finance · Admin Overview</span>
              <span>
                Demo figures only. Real reporting requires verified payment,
                subscription and expense records.
              </span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
