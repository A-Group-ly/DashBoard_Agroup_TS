import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CreditCard,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  RefreshCw,
  Receipt,
  Wallet,
} from "lucide-react";

type Period = "monthly" | "weekly";

type PeriodStats = {
  from: string;
  to: string;
  newSubscriptions: number;
  paidSubscriptions: number;
  paymentsReceived: { LYD: string; USD: string };
  expenses: { LYD: string; USD: string };
  netProfit: { LYD: string; USD: string };
};

type DashboardSummary = {
  period: Period;
  current: PeriodStats;
  previous: PeriodStats;
  comparison: {
    newSubscriptions: number | null;
    paidSubscriptions: number | null;
    paymentsLYD: number | null;
    paymentsUSD: number | null;
  };
  outstandingPayables: {
    LYD: string;
    USD: string;
  };
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

function money(value: string, currency: "LYD" | "USD") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return currency === "LYD" ? "0.00 LYD" : "$0.00";
  }

  return currency === "LYD"
    ? `${number.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} LYD`
    : `$${number.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

function formatChange(value: number | null) {
  if (value === null) return "No previous baseline";

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  change?: number | null;
  icon: typeof Activity;
  description?: string;
}) {
  const positive = change !== null && change !== undefined && change >= 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h2 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </h2>
        </div>

        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
          <Icon size={22} />
        </div>
      </div>

      {change !== undefined ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
          {change === null ? (
            <span className="text-slate-500">No previous-period baseline</span>
          ) : (
            <>
              {positive ? (
                <ArrowUpRight
                  size={17}
                  className="text-emerald-700"
                />
              ) : (
                <ArrowDownRight
                  size={17}
                  className="text-rose-700"
                />
              )}
              <span
                className={
                  positive
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-rose-700"
                }
              >
                {formatChange(change)}
              </span>
              <span className="text-slate-500">{description}</span>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function App() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/dashboard/summary?period=${period}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`API request failed (${response.status})`);
        }

        const result =
          (await response.json()) as DashboardSummary;

        setSummary(result);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [period]);

  const comparisonLabel =
    period === "monthly" ? "vs. last month" : "vs. last week";

  function exportCSV() {
    if (!summary) return;

    const current = summary.current;
    const previous = summary.previous;

    const rows = [
      ["Metric", "Current Period", "Previous Period", "Currency"],
      [
        "New Subscriptions",
        current.newSubscriptions,
        previous.newSubscriptions,
        "Count",
      ],
      [
        "Paid Subscriptions",
        current.paidSubscriptions,
        previous.paidSubscriptions,
        "Count",
      ],
      [
        "Payments Received",
        current.paymentsReceived.LYD,
        previous.paymentsReceived.LYD,
        "LYD",
      ],
      [
        "Payments Received",
        current.paymentsReceived.USD,
        previous.paymentsReceived.USD,
        "USD",
      ],
      ["Expenses", current.expenses.LYD, previous.expenses.LYD, "LYD"],
      ["Expenses", current.expenses.USD, previous.expenses.USD, "USD"],
      ["Net Profit / Loss", current.netProfit.LYD, previous.netProfit.LYD, "LYD"],
      ["Net Profit / Loss", current.netProfit.USD, previous.netProfit.USD, "USD"],
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `financial-overview-${period}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  const dateLabel = summary
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
      }).format(new Date(summary.current.from))
    : new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(new Date());

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col bg-[#171717] text-white lg:flex">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="rounded-xl bg-white p-2 text-[#171717]">
              <Activity size={23} />
            </div>
            <div>
              <p className="font-bold tracking-wide">COMPANY FINANCE</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Subscription Management
              </p>
            </div>
          </div>

          <nav className="space-y-1 px-4 pt-8">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Workspace
            </p>
            <a
              href="#overview"
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-medium text-[#171717]"
            >
              <LayoutDashboard size={19} />
              Overview
            </a>
            <a
              href="#subscriptions"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={19} />
              Subscriptions
            </a>
            <a
              href="#profit-loss"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <Receipt size={19} />
              Profit &amp; Loss
            </a>
            <a
              href="#payables"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <Landmark size={19} />
              Payables
            </a>
          </nav>

          <div className="mt-auto border-t border-white/10 p-5">
            <p className="text-xs text-slate-400">Admin Workspace</p>
            <p className="mt-1 text-sm font-medium">Financial Dashboard</p>
          </div>
        </aside>

        <main id="overview" className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-5 px-5 py-6 sm:px-8 xl:flex-row xl:items-center">
              <div>
                <p className="text-sm text-slate-500">
                  Workspace / Overview
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Financial Overview
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Monitor subscriptions, payments and company finances.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
                  {(["monthly", "weekly"] as Period[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => setPeriod(option)}
                      aria-pressed={period === option}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
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
                  onClick={exportCSV}
                  disabled={!summary}
                  className="rounded-xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export CSV
                </button>

                <button
                  aria-label="Notifications"
                  className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600"
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
                {period === "monthly"
                  ? dateLabel
                  : "Current Week"}
              </div>

              <div
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  error
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : loading
                      ? "border-slate-200 bg-white text-slate-600"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {error
                  ? `API unavailable · ${error}`
                  : loading
                    ? "Loading financial data..."
                    : "Connected to API · MySQL-backed data"}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-semibold">
                  Could not load financial information.
                </p>
                <p className="mt-1">
                  Confirm that the NestJS server is running at{" "}
                  {API_BASE_URL} and that the database connection is active.
                </p>
                <button
                  className="mt-3 rounded-lg border border-rose-300 px-3 py-2 font-medium"
                  onClick={() => setPeriod((value) => value)}
                >
                  Retry
                </button>
              </div>
            )}

            {loading && !summary ? (
              <div className="flex min-h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3 text-slate-500">
                  <LoaderCircle className="animate-spin" />
                  Loading dashboard data...
                </div>
              </div>
            ) : summary ? (
              <>
                <section
                  id="subscriptions"
                  className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
                >
                  <MetricCard
                    title="New Subscriptions"
                    value={summary.current.newSubscriptions.toLocaleString("en-US")}
                    change={summary.comparison.newSubscriptions}
                    description={comparisonLabel}
                    icon={RefreshCw}
                  />
                  <MetricCard
                    title="Payments Received · LYD"
                    value={money(summary.current.paymentsReceived.LYD, "LYD")}
                    change={summary.comparison.paymentsLYD}
                    description={comparisonLabel}
                    icon={Wallet}
                  />
                  <MetricCard
                    title="Payments Received · USD"
                    value={money(summary.current.paymentsReceived.USD, "USD")}
                    change={summary.comparison.paymentsUSD}
                    description={comparisonLabel}
                    icon={CreditCard}
                  />
                  <MetricCard
                    title="Paid Subscriptions"
                    value={summary.current.paidSubscriptions.toLocaleString("en-US")}
                    change={summary.comparison.paidSubscriptions}
                    description={comparisonLabel}
                    icon={Receipt}
                  />
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold">
                      Current vs. Previous Period
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Real counts and payments returned by the API.
                    </p>

                    <div className="mt-5 space-y-4">
                      {[
                        {
                          title: "New Subscriptions",
                          current: String(summary.current.newSubscriptions),
                          previous: String(summary.previous.newSubscriptions),
                        },
                        {
                          title: "Paid Subscriptions",
                          current: String(summary.current.paidSubscriptions),
                          previous: String(summary.previous.paidSubscriptions),
                        },
                        {
                          title: "Payments · LYD",
                          current: money(summary.current.paymentsReceived.LYD, "LYD"),
                          previous: money(summary.previous.paymentsReceived.LYD, "LYD"),
                        },
                        {
                          title: "Payments · USD",
                          current: money(summary.current.paymentsReceived.USD, "USD"),
                          previous: money(summary.previous.paymentsReceived.USD, "USD"),
                        },
                      ].map((item) => (
                        <div
                          key={item.title}
                          className="grid gap-2 border-b border-slate-100 pb-3 sm:grid-cols-3"
                        >
                          <span className="text-sm text-slate-500">
                            {item.title}
                          </span>
                          <span className="font-semibold">
                            Current: {item.current}
                          </span>
                          <span className="text-sm text-slate-500">
                            Previous: {item.previous}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article
                    id="profit-loss"
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <h2 className="text-lg font-bold">Profit &amp; Loss</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Current-period results, separated by currency.
                    </p>

                    {(["LYD", "USD"] as const).map((currency) => (
                      <div
                        key={currency}
                        className="mt-5 rounded-xl bg-slate-50 p-4"
                      >
                        <h3 className="font-semibold">
                          {currency === "LYD" ? "Libyan Dinar" : "US Dollar"}
                        </h3>
                        <div className="mt-3 space-y-3 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Payments Received</span>
                            <span className="font-medium">
                              {money(summary.current.paymentsReceived[currency], currency)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Expenses</span>
                            <span className="font-medium">
                              {money(summary.current.expenses[currency], currency)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-t border-slate-200 pt-3">
                            <span className="font-semibold">Net Profit / Loss</span>
                            <span className="font-bold text-emerald-800">
                              {money(summary.current.netProfit[currency], currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </article>
                </section>

                <section
                  id="payables"
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-amber-50 p-3 text-amber-800">
                      <Landmark size={22} />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-bold">Company Outstanding Payables</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Outstanding amounts the company owes to vendors.
                      </p>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-sm text-slate-500">Payables · LYD</p>
                          <p className="mt-2 text-2xl font-bold">
                            {money(summary.outstandingPayables.LYD, "LYD")}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-sm text-slate-500">Payables · USD</p>
                          <p className="mt-2 text-2xl font-bold">
                            {money(summary.outstandingPayables.USD, "USD")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            <footer className="border-t border-slate-200 py-5 text-xs text-slate-500">
              Subscription Finance · Financial totals are loaded from the backend API.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;