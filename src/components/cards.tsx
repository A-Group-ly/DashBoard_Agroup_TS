import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Landmark,
  Lock,
  Minus,
  Wallet,
} from "lucide-react";

import { toCents } from "../../shared/money";
import type {
  Currency,
  MoneyByCurrency,
  RecentSubscription,
  SubscriptionStatus,
} from "../../shared/types";
import { formatCents, formatChange, formatDateTime, money } from "../lib/format";

export function ChangeIndicator({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-sm text-slate-500">N/A</span>;
  }

  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const Icon = normalized > 0 ? ArrowUpRight : normalized < 0 ? ArrowDownRight : Minus;
  const color =
    normalized > 0 ? "text-emerald-700" : normalized < 0 ? "text-rose-700" : "text-slate-500";

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${color}`}>
      <Icon size={18} />
      {formatChange(normalized)}
      <span className="font-normal text-slate-500">vs previous</span>
    </span>
  );
}

export function SubscriptionCard({
  count,
  paidCount,
  change,
}: {
  count: number;
  paidCount: number;
  change: number | null;
}) {
  return (
    <article className="flex min-h-[190px] flex-col justify-between rounded-2xl border border-slate-300 bg-slate-200 p-5 shadow-sm transition hover:shadow-md sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-600">NEW SUBSCRIPTIONS</p>
          <p className="mt-4 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {count.toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-slate-100 p-3.5 text-slate-700">
          <Activity size={25} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <ChangeIndicator value={change} />
        <span
          className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
          title="Subscriptions with at least one successful payment in this period"
        >
          {paidCount.toLocaleString("en-US")} paid this period
        </span>
      </div>
    </article>
  );
}

export function ProfitCard({
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
  const difference = currentCents - toCents(previousProfit);

  const DifferenceIcon = difference > 0n ? ArrowUpRight : difference < 0n ? ArrowDownRight : Minus;
  const differenceColor =
    difference > 0n ? "text-emerald-800" : difference < 0n ? "text-rose-800" : "text-slate-500";

  return (
    <button
      type="button"
      onClick={() => setCurrency(currency === "LYD" ? "USD" : "LYD")}
      aria-label={`Net profit is shown in ${currency}. Click to switch currency.`}
      className="group flex min-h-[190px] w-full flex-col justify-between rounded-2xl border border-slate-400 bg-slate-300 p-5 text-left shadow-sm transition hover:border-slate-500 hover:bg-slate-200 hover:shadow-md sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-wide text-slate-700">NET PROFIT / LOSS</p>
            <span className="rounded-full border border-slate-400 bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800">
              {currency}
            </span>
          </div>
          <p
            className={`mt-4 break-words font-display text-3xl font-bold tracking-tight sm:text-4xl ${
              currentCents < 0n ? "text-rose-800" : "text-slate-900"
            }`}
          >
            {money(currentProfit, currency)}
          </p>
          <p className="mt-2 text-sm text-slate-600">Successful payments minus recorded expenses</p>
        </div>
        <div className="shrink-0 rounded-2xl border border-slate-400 bg-slate-200 p-3.5 text-slate-700 transition group-hover:bg-slate-100">
          <Wallet size={25} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-slate-400 pt-4">
        <div>
          <p className="text-xs font-semibold text-slate-600">DIFFERENCE VS PREVIOUS</p>
          <p className={`mt-2 flex items-center gap-1.5 text-base font-bold ${differenceColor}`}>
            <DifferenceIcon size={19} />
            {formatCents(difference, currency)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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

export function MiniStat({
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
      <p className="mt-3 break-words font-display text-lg font-bold text-slate-900 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

export function FinanceLockedCard() {
  return (
    <section className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-400 bg-slate-100 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-slate-700">
        <Lock size={20} />
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-slate-900">Financial figures are hidden</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-600">
        Your role can see subscriptions only. Revenue, expenses, profit and payables need the
        Finance or Super admin role. Ask an administrator if you need access.
      </p>
    </section>
  );
}

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE: "border-emerald-300 bg-emerald-100 text-emerald-800",
  PENDING: "border-amber-300 bg-amber-100 text-amber-800",
  CANCELLED: "border-rose-300 bg-rose-100 text-rose-800",
  EXPIRED: "border-slate-300 bg-slate-200 text-slate-700",
};

const STATUS_BARS: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-emerald-600",
  PENDING: "bg-amber-500",
  CANCELLED: "bg-rose-600",
  EXPIRED: "bg-slate-500",
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span
      className={`status-badge inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StatusBreakdown({ counts }: { counts: Record<SubscriptionStatus, number> }) {
  const order: SubscriptionStatus[] = ["ACTIVE", "PENDING", "CANCELLED", "EXPIRED"];
  const total = order.reduce((sum, status) => sum + counts[status], 0);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-slate-900">All subscriptions</h2>
      <p className="mt-1 text-sm text-slate-600">
        {total.toLocaleString("en-US")} in total, by current status
      </p>

      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-300" aria-hidden="true">
        {order.map((status) =>
          counts[status] > 0 ? (
            <div
              key={status}
              className={`status-bar ${STATUS_BARS[status]}`}
              style={{ width: `${(counts[status] / Math.max(total, 1)) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3">
        {order.map((status) => (
          <li key={status} className="rounded-xl border border-slate-300 bg-slate-200 p-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className={`status-bar h-2.5 w-2.5 rounded-sm ${STATUS_BARS[status]}`} />
              {STATUS_LABELS[status]}
            </span>
            <span className="mt-1 block font-display text-xl font-bold text-slate-900">
              {counts[status].toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RecentSubscriptions({ items }: { items: RecentSubscription[] }) {
  const showAmount = items.some((item) => item.amount !== null);

  return (
    <section className="h-full rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-slate-900">Latest subscriptions</h2>
      <p className="mt-1 text-sm text-slate-600">The most recent sign-ups, straight from the database.</p>

      {items.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-300 bg-slate-200 p-4 text-sm text-slate-600">
          No subscriptions yet.
        </p>
      ) : (
        <>
          {/* Phones: stacked list */}
          <ul className="mt-4 divide-y divide-slate-300 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{item.company}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {item.plan} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={item.status} />
                  {item.amount !== null && (
                    <span className="text-sm font-semibold text-slate-800">
                      {money(item.amount, item.currency)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Tablets and up: table */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Company</th>
                  <th className="py-2 pr-4 font-semibold">Plan</th>
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Payment</th>
                  {showAmount && <th className="py-2 text-right font-semibold">Amount</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-300 last:border-0">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{item.company}</td>
                    <td className="py-3 pr-4 text-slate-700">{item.plan}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-slate-600">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{item.paid ? "Paid" : "Awaiting"}</td>
                    {showAmount && (
                      <td className="whitespace-nowrap py-3 text-right font-semibold text-slate-900">
                        {item.amount !== null ? money(item.amount, item.currency) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function PayablesCard({ payables }: { payables: MoneyByCurrency }) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-slate-200 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="hidden rounded-xl border border-slate-300 bg-slate-100 p-3 text-slate-700 sm:block">
          <Landmark size={22} />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold text-slate-900">Outstanding payables</h2>
          <p className="mt-1 text-sm text-slate-600">Remaining bills and obligations owed by A-Group.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(["LYD", "USD"] as const).map((currency) => (
              <div key={currency} className="rounded-xl border border-slate-300 bg-slate-100 p-4">
                <p className="text-sm text-slate-600">Payables · {currency}</p>
                <p className="mt-2 font-display text-2xl font-bold text-slate-900">
                  {money(payables[currency], currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
