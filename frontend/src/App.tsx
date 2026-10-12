
import "./theme.css";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Landmark,
  LoaderCircle,
  Moon,
  Minus,
  RefreshCw,
  Sun,
  TrendingUp,
  Wallet,
} from "lucide-react";

type Period = "monthly" | "weekly";
type Currency = "LYD" | "USD";
type Theme = "light" | "dark";

type MoneyByCurrency = {
  LYD: string;
  USD: string;
};

type PeriodStats = {
  from: string;
  to: string;
  newSubscriptions: number;
  paidSubscriptions: number;
  paymentsReceived: MoneyByCurrency;
  expenses: MoneyByCurrency;
  netProfit: MoneyByCurrency;
};

type ProfitHistoryPoint = {
  key: string;
  label: string;
  netProfit: MoneyByCurrency;
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
    profitLYD?: number | null;
    profitUSD?: number | null;
  };
  profitHistory?: ProfitHistoryPoint[];
  outstandingPayables: MoneyByCurrency;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

const COMPANY_TIME_ZONE = "Africa/Tripoli";
const REFRESH_INTERVAL_SECONDS = 60;

function toCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  const whole = BigInt(match[2]);
  const fraction = BigInt(
    (match[3] ?? "").padEnd(2, "0").slice(0, 2),
  );

  const cents = whole * BigInt(100) + fraction;

  return match[1] === "-" ? -cents : cents;
}

function formatCents(cents: bigint, currency: Currency): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  const whole = absolute / BigInt(100);
  const fraction = (absolute % BigInt(100))
    .toString()
    .padStart(2, "0");

  const formatted = `${whole.toLocaleString("en-US")}.${fraction}`;
  const sign = negative ? "−" : "";

  return currency === "LYD"
    ? `${sign}${formatted} LYD`
    : `${sign}$${formatted}`;
}

function money(value: string, currency: Currency): string {
  return formatCents(toCents(value), currency);
}

function formatChange(value: number | null | undefined): string {
  if (value == null) return "N/A";

  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const sign = normalized > 0 ? "+" : normalized < 0 ? "−" : "";

  return `${sign}${Math.abs(normalized).toFixed(1)}%`;
}

function ChangeIndicator({
  value,
}: {
  value: number | null | undefined;
}) {
  if (value == null) {
    return <span className="text-sm text-slate-500">N/A</span>;
  }

  const normalized = Math.abs(value) < 0.05 ? 0 : value;

  const Icon =
    normalized > 0
      ? ArrowUpRight
      : normalized < 0
        ? ArrowDownRight
        : Minus;

  const color =
    normalized > 0
      ? "text-emerald-700"
      : normalized < 0
        ? "text-rose-700"
        : "text-slate-500";

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${color}`}>
      <Icon size={18} />
      {formatChange(normalized)}
    </span>
  );
}

function SubscriptionCard({
  count,
  paidCount,
  change,
}: {
  count: number;
  paidCount: number;
  change: number | null;
}) {
  return (
    <article className="flex min-h-[205px] flex-col justify-between rounded-2xl border border-slate-300 bg-slate-200 p-6 shadow-sm transition hover:shadow-md sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-600">
            NEW SUBSCRIPTIONS
          </p>

          <p className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {count.toLocaleString("en-US")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-slate-100 p-3.5 text-slate-700">
          <Activity size={25} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <ChangeIndicator value={change} />

        <span className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          {paidCount.toLocaleString("en-US")} paid
        </span>
      </div>
    </article>
  );
}

function ProfitCard({
  currency,
  setCurrency,
  currentProfit,
  previousProfit,
  change,
}: {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  currentProfit: string;
  previousProfit: string;
  change: number | null | undefined;
}) {
  const currentCents = toCents(currentProfit);
  const previousCents = toCents(previousProfit);
  const difference = currentCents - previousCents;

  const DifferenceIcon =
    difference > BigInt(0)
      ? ArrowUpRight
      : difference < BigInt(0)
        ? ArrowDownRight
        : Minus;

  const differenceColor =
    difference > BigInt(0)
      ? "text-emerald-800"
      : difference < BigInt(0)
        ? "text-rose-800"
        : "text-slate-500";

  return (
    <button
      type="button"
      onClick={() => setCurrency(currency === "LYD" ? "USD" : "LYD")}
      aria-label={`Net profit is shown in ${currency}. Click to switch currency.`}
      className="group flex min-h-[205px] w-full flex-col justify-between rounded-2xl border border-slate-400 bg-slate-300 p-6 text-left shadow-sm transition hover:border-slate-500 hover:bg-slate-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-500 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-wide text-slate-700">
              NET PROFIT / LOSS
            </p>

            <span className="rounded-full border border-slate-400 bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800">
              {currency}
            </span>
          </div>

          <p
            className={`mt-5 break-words text-3xl font-bold tracking-tight sm:text-4xl ${
              currentCents < BigInt(0)
                ? "text-rose-800"
                : "text-slate-900"
            }`}
          >
            {money(currentProfit, currency)}
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Successful payments minus recorded expenses
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-slate-400 bg-slate-200 p-3.5 text-slate-700 transition group-hover:bg-slate-100">
          <Wallet size={25} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-slate-400 pt-4">
        <div>
          <p className="text-xs font-semibold text-slate-600">
            PROFIT DIFFERENCE
          </p>

          <p className={`mt-2 flex items-center gap-1.5 text-base font-bold ${differenceColor}`}>
            <DifferenceIcon size={19} />
            {formatCents(difference, currency)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ChangeIndicator value={change} />

          <span className="flex items-center gap-1.5 rounded-lg border border-slate-400 bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
            <ArrowLeftRight size={14} />
            Switch currency
          </span>
        </div>
      </div>
    </button>
  );
}

function ProfitChart({
  points,
  currency,
}: {
  points: ProfitHistoryPoint[];
  currency: Currency;
}) {
  const values = points.map((point) => {
    const value = Number(point.netProfit[currency]);
    return Number.isFinite(value) ? value : 0;
  });

  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const range = rawMax - rawMin || 1;

  const minValue = rawMin - range * 0.12;
  const maxValue = rawMax + range * 0.12;

  const width = 900;
  const height = 420;
  const left = 82;
  const right = 24;
  const top = 30;
  const bottom = 55;

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const yAt = (value: number) =>
    top +
    ((maxValue - value) / (maxValue - minValue)) * chartHeight;

  const zeroY = yAt(0);
  const slotWidth = chartWidth / Math.max(points.length, 1);
  const barWidth = Math.min(42, slotWidth * 0.55);

  const ticks = Array.from(
    { length: 5 },
    (_, index) => maxValue - (index / 4) * (maxValue - minValue),
  );

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm sm:p-6">
      <div>
        <div className="flex items-center gap-2">
          <TrendingUp size={22} className="text-slate-700" />

          <h2 className="text-lg font-bold text-slate-900">
            Profit Performance
          </h2>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          {currency === "LYD" ? "Libyan Dinar" : "US Dollar"} ·{" "}
          {points.length} reporting periods
        </p>
      </div>

      {points.length === 0 ? (
        <div className="mt-6 flex min-h-64 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 p-4 text-center text-sm text-slate-600">
          No historical profit data is available yet.
        </div>
      ) : (
        <div className="mt-5 flex-1 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Profit and loss column chart in ${currency}`}
            className="h-auto w-full min-w-[390px]"
          >
            {ticks.map((tick, index) => {
              const y = yAt(tick);

              return (
                <g key={index}>
                  <line
                    x1={left}
                    y1={y}
                    x2={width - right}
                    y2={y}
                    stroke="#cbd5e1"
                    strokeDasharray="4 5"
                  />

                  <text
                    x={left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="#475569"
                  >
                    {tick.toLocaleString("en-US", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    })}
                  </text>
                </g>
              );
            })}

            <line
              x1={left}
              y1={zeroY}
              x2={width - right}
              y2={zeroY}
              stroke="#64748b"
              strokeWidth="1.5"
            />

            {points.map((point, index) => {
              const value = values[index];
              const valueY = yAt(value);
              const barHeight = Math.max(2, Math.abs(zeroY - valueY));

              const x =
                left +
                index * slotWidth +
                (slotWidth - barWidth) / 2;

              const y = Math.min(zeroY, valueY);

              return (
                <g key={point.key}>
                  <rect
                    className={
                      value < 0
                        ? "profit-bar-negative"
                        : "profit-bar-positive"
                    }
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    fill={value < 0 ? "#e11d48" : "#16a34a"}
                  >
                    <title>
                      {point.label}: {money(point.netProfit[currency], currency)}
                    </title>
                  </rect>

                  <text
                    x={x + barWidth / 2}
                    y={height - 23}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#475569"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-300 pt-4 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          Positive profit
        </span>

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" />
          Net loss
        </span>
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{label}</p>
        <Icon size={19} className="shrink-0 text-slate-600" />
      </div>

      <p className="mt-3 break-words text-lg font-bold text-slate-900 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function App() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [currency, setCurrency] = useState<Currency>("LYD");

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return window.localStorage.getItem("a-group-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [clock, setClock] = useState<Date>(() => new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] =
    useState(REFRESH_INTERVAL_SECONDS);

  const countdownRef = useRef(REFRESH_INTERVAL_SECONDS);

  useEffect(() => {
    try {
      window.localStorage.setItem("a-group-theme", theme);
    } catch {
      // The dashboard remains functional if browser storage is unavailable.
    }
  }, [theme]);

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

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/dashboard/summary?period=${period}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`API request failed (${response.status})`);
        }

        const result = (await response.json()) as DashboardSummary;

        if (!result.current || !result.previous || !result.comparison) {
          throw new Error(
            "The API response is missing required dashboard fields.",
          );
        }

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
  }, [period, reloadKey]);

  const current = summary?.current;
  const previous = summary?.previous;
  const comparison = summary?.comparison;

  function refreshNow() {
    countdownRef.current = REFRESH_INTERVAL_SECONDS;
    setSecondsUntilRefresh(REFRESH_INTERVAL_SECONDS);
    setClock(new Date());
    setReloadKey((value) => value + 1);
  }

  function selectPeriod(option: Period) {
    setPeriod(option);
    countdownRef.current = REFRESH_INTERVAL_SECONDS;
    setSecondsUntilRefresh(REFRESH_INTERVAL_SECONDS);
    setClock(new Date());
  }

  const countdownLabel = `${String(
    Math.floor(secondsUntilRefresh / 60),
  ).padStart(2, "0")}:${String(secondsUntilRefresh % 60).padStart(2, "0")}`;

  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(clock);

  const reportingLabel = current?.from
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: COMPANY_TIME_ZONE,
        month: "long",
        year: "numeric",
      }).format(new Date(current.from))
    : new Intl.DateTimeFormat("en-US", {
        timeZone: COMPANY_TIME_ZONE,
        month: "long",
        year: "numeric",
      }).format(clock);

  function exportCSV() {
    if (!summary) return;

    const rows = [
      ["Metric", "Current Period", "Previous Period", "Currency"],
      [
        "New Subscriptions",
        summary.current.newSubscriptions,
        summary.previous.newSubscriptions,
        "Count",
      ],
      [
        "Paid Subscriptions",
        summary.current.paidSubscriptions,
        summary.previous.paidSubscriptions,
        "Count",
      ],
      [
        "Payments Received",
        summary.current.paymentsReceived.LYD,
        summary.previous.paymentsReceived.LYD,
        "LYD",
      ],
      [
        "Payments Received",
        summary.current.paymentsReceived.USD,
        summary.previous.paymentsReceived.USD,
        "USD",
      ],
      [
        "Expenses",
        summary.current.expenses.LYD,
        summary.previous.expenses.LYD,
        "LYD",
      ],
      [
        "Expenses",
        summary.current.expenses.USD,
        summary.previous.expenses.USD,
        "USD",
      ],
      [
        "Net Profit / Loss",
        summary.current.netProfit.LYD,
        summary.previous.netProfit.LYD,
        "LYD",
      ],
      [
        "Net Profit / Loss",
        summary.current.netProfit.USD,
        summary.previous.netProfit.USD,
        "USD",
      ],
      ["Outstanding Payables", summary.outstandingPayables.LYD, "", "LYD"],
      ["Outstanding Payables", summary.outstandingPayables.USD, "", "USD"],
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `a-group-financial-overview-${period}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <div
      data-theme={theme}
      className="app-shell min-h-screen bg-[#f1f3f5] text-slate-900 transition-colors duration-300"
    >
      <header className="border-b border-slate-300 bg-slate-100">
        <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="brand-logo-frame">
              <img
                src="/a-group-logo.png"
                alt="A-Group company logo"
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <p className="text-sm font-bold tracking-[0.15em] text-slate-700">
                A-GROUP
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Financial Overview
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Empowering Libya through innovative digital solutions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-slate-300 bg-slate-200 p-1">
              {(["monthly", "weekly"] as Period[]).map((option) => (
                <button
                  key={option}
                  onClick={() => selectPeriod(option)}
                  aria-pressed={period === option}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition ${
                    period === option
                      ? "bg-slate-700 text-white"
                      : "text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-3 py-2.5 text-xs font-semibold tabular-nums text-slate-700"
              title="The dashboard refreshes every 60 seconds."
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh in {countdownLabel}
            </div>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-3 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-300"
            >
              <ThemeIcon size={18} />
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>

            <button
              onClick={exportCSV}
              disabled={!summary}
              className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={17} />
              Export CSV
            </button>

            <button
              type="button"
              aria-label="Refresh dashboard now"
              onClick={refreshNow}
              className="rounded-xl border border-slate-300 bg-slate-200 p-3 text-slate-700 transition hover:bg-slate-300"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-7 px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {reportingLabel}
              {period === "weekly" && " · Current week"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {currentDateLabel}
            </p>
          </div>

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
              <CheckCircle2 size={14} />
            )}

            {error
              ? `API unavailable · ${error}`
              : loading
                ? "Updating financial data..."
                : "Connected to database"}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-100 p-4 text-sm text-rose-800">
            <p className="font-semibold">
              Could not load financial information.
            </p>

            <p className="mt-1">
              Confirm that NestJS and MySQL are running.
            </p>

            <button
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
        ) : summary && current && previous && comparison ? (
          <>
            <section className="grid items-stretch gap-5 xl:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-5">
                <SubscriptionCard
                  count={current.newSubscriptions}
                  paidCount={current.paidSubscriptions}
                  change={comparison.newSubscriptions}
                />

                <ProfitCard
                  currency={currency}
                  setCurrency={setCurrency}
                  currentProfit={current.netProfit[currency]}
                  previousProfit={previous.netProfit[currency]}
                  change={
                    currency === "LYD"
                      ? comparison.profitLYD
                      : comparison.profitUSD
                  }
                />
              </div>

              <div className="min-w-0">
                <ProfitChart
                  points={summary.profitHistory ?? []}
                  currency={currency}
                />
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Financial Snapshot
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Received payments and expenses, separated by currency.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MiniStat
                  label="Payments Received · LYD"
                  value={money(current.paymentsReceived.LYD, "LYD")}
                  icon={Wallet}
                />

                <MiniStat
                  label="Payments Received · USD"
                  value={money(current.paymentsReceived.USD, "USD")}
                  icon={CreditCard}
                />

                <MiniStat
                  label="Expenses · LYD"
                  value={money(current.expenses.LYD, "LYD")}
                  icon={Activity}
                />

                <MiniStat
                  label="Expenses · USD"
                  value={money(current.expenses.USD, "USD")}
                  icon={Activity}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-300 bg-slate-200 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 text-slate-700">
                  <Landmark size={22} />
                </div>

                <div className="flex-1">
                  <h2 className="font-bold text-slate-900">
                    Outstanding Payables
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Remaining bills and obligations owed by A-Group.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-300 bg-slate-100 p-4">
                      <p className="text-sm text-slate-600">
                        Payables · LYD
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {money(summary.outstandingPayables.LYD, "LYD")}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-300 bg-slate-100 p-4">
                      <p className="text-sm text-slate-600">
                        Payables · USD
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {money(summary.outstandingPayables.USD, "USD")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-300 py-5 text-xs text-slate-600 sm:flex-row">
          <span>A-Group · Financial Dashboard</span>
          <span>Currency totals are displayed separately.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
