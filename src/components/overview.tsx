import { memo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Hourglass,
  Landmark,
  Minus,
  TrendingUp,
  Users,
} from "lucide-react";

import { centsToDecimal, toCents } from "../../shared/money";
import type { Currency, DashboardSummary, MoneyByCurrency } from "../../shared/types";
import { formatCents, formatChange, money } from "../lib/format";

type Finance = NonNullable<DashboardSummary["finance"]>;

const other = (currency: Currency): Currency => (currency === "LYD" ? "USD" : "LYD");

export function ChangeBadge({
  value,
  invert = false,
  label = "vs previous",
}: {
  value: number | null | undefined;
  /** for costs, going up is bad */
  invert?: boolean;
  label?: string;
}) {
  if (value == null) {
    return <span className="text-xs text-slate-500">No earlier data</span>;
  }
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const good = invert ? normalized < 0 : normalized > 0;
  const bad = invert ? normalized > 0 : normalized < 0;
  const Icon = normalized > 0 ? ArrowUpRight : normalized < 0 ? ArrowDownRight : Minus;
  const tone = good
    ? "border-emerald-300 bg-emerald-100 text-emerald-800"
    : bad
      ? "border-rose-300 bg-rose-100 text-rose-800"
      : "border-slate-300 bg-slate-200 text-slate-700";

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${tone}`}>
        <Icon size={13} />
        {formatChange(normalized)}
      </span>
      {label}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  hint,
  children,
  accent = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <article
      className={`hover-card flex min-w-0 flex-col rounded-2xl border p-5 shadow-sm sm:p-6 ${
        accent ? "border-slate-400 bg-slate-300" : "border-slate-300 bg-slate-100"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        <span className="rounded-xl border border-slate-300 bg-slate-200 p-2.5 text-slate-700">
          <Icon size={20} />
        </span>
      </header>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </article>
  );
}

function Amount({ value, currency, tone }: { value: string; currency: Currency; tone?: "auto" }) {
  const negative = tone === "auto" && toCents(value) < 0n;
  return (
    <p
      className={`break-words font-display text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl ${
        negative ? "text-rose-800" : "text-slate-900"
      }`}
    >
      {money(value, currency)}
    </p>
  );
}

function SecondaryAmount({ value, currency }: { value: MoneyByCurrency; currency: Currency }) {
  const second = other(currency);
  return (
    <p className="mt-1 text-sm text-slate-600">
      + {money(value[second], second)}
    </p>
  );
}

function Line({ label, value, tone }: { label: ReactNode; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          tone === "good" ? "text-emerald-800" : tone === "bad" ? "text-rose-800" : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The financial headline: what came in, what's left, and what's due by the
 * end of the month. Amounts show the selected currency large and the other
 * currency underneath; the two are never added together.
 */
export const FinanceOverview = memo(function FinanceOverview({
  finance,
  currency,
  periodLabel,
}: {
  finance: Finance;
  currency: Currency;
  periodLabel: string;
}) {
  const { current, change, obligations, dueByMonthEnd } = finance;
  const payables = obligations.payables;

  const paidShare = (() => {
    const total = toCents(payables.total[currency]);
    if (total <= 0n) return 100;
    return Number((toCents(payables.paid[currency]) * 1000n) / total) / 10;
  })();

  const expectedIn = {
    LYD: toCents(dueByMonthEnd.renewals.amount.LYD) + toCents(obligations.receivables.remaining.LYD),
    USD: toCents(dueByMonthEnd.renewals.amount.USD) + toCents(obligations.receivables.remaining.USD),
  };
  const billsDue = toCents(dueByMonthEnd.bills.amount[currency]);
  const netDue = expectedIn[currency] - billsDue;

  return (
    <section aria-labelledby="finance-heading" className="fade-in">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="finance-heading" className="font-display text-lg font-bold text-slate-900 sm:text-xl">
            Financial overview
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Money in and out for {periodLabel}, plus what is still owed today.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={CircleDollarSign} title="Total paid" hint={`Received · ${periodLabel}`} accent>
          <Amount value={current.paymentsReceived[currency]} currency={currency} />
          <SecondaryAmount value={current.paymentsReceived} currency={currency} />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
            <ChangeBadge value={currency === "LYD" ? change.paymentsLYD : change.paymentsUSD} />
            <span className="text-xs text-slate-600">
              {current.paymentsCount.toLocaleString("en-US")} payments
            </span>
          </div>
          <p className="mt-3 border-t border-slate-400 pt-3 text-xs text-slate-600">
            All-time received: <strong className="text-slate-800">{money(finance.lifetimePaid[currency], currency)}</strong>
          </p>
        </SummaryCard>

        <SummaryCard icon={TrendingUp} title="Net profit / loss" hint="Payments minus expenses">
          <Amount value={current.netProfit[currency]} currency={currency} tone="auto" />
          <SecondaryAmount value={current.netProfit} currency={currency} />
          <div className="mt-3 space-y-1.5">
            <Line label="Payments" value={money(current.paymentsReceived[currency], currency)} />
            <Line label="Expenses" value={`− ${money(current.expenses[currency], currency)}`} />
          </div>
          <div className="mt-auto pt-4">
            <ChangeBadge value={currency === "LYD" ? change.profitLYD : change.profitUSD} />
          </div>
        </SummaryCard>

        <SummaryCard icon={Landmark} title="Outstanding debts" hint="Bills A-Group still owes · today">
          <Amount value={payables.remaining[currency]} currency={currency} />
          <SecondaryAmount value={payables.remaining} currency={currency} />
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-600">
              <span>{paidShare.toFixed(0)}% of {formatCents(toCents(payables.total[currency]), currency)} paid</span>
              <span>{payables.count} bills</span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-300"
              role="progressbar"
              aria-valuenow={Math.round(paidShare)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Share of bills already paid"
            >
              <div className="h-full rounded-full" style={{ width: `${paidShare}%`, background: "var(--chart-1)" }} />
            </div>
          </div>
          <div className="mt-auto border-t border-slate-300 pt-3">
            <Line
              label={
                <span className="flex items-center gap-1.5">
                  <Hourglass size={13} /> Customers still owe ({obligations.receivables.count})
                </span>
              }
              value={money(obligations.receivables.remaining[currency], currency)}
            />
          </div>
        </SummaryCard>

        <SummaryCard icon={CalendarClock} title={`Due by ${dueByMonthEnd.label}`} hint="Expected until the end of this month">
          <Amount value={centsToDecimal(expectedIn[currency])} currency={currency} />
          <p className="mt-1 text-sm text-slate-600">expected to come in</p>
          <div className="mt-3 space-y-1.5">
            <Line
              label={`Renewals (${dueByMonthEnd.renewals.count})`}
              value={money(dueByMonthEnd.renewals.amount[currency], currency)}
            />
            <Line
              label="Unpaid sign-ups"
              value={money(obligations.receivables.remaining[currency], currency)}
            />
            <Line
              label={`Bills to pay (${dueByMonthEnd.bills.count})`}
              value={`− ${money(dueByMonthEnd.bills.amount[currency], currency)}`}
            />
          </div>
          <div className="mt-auto border-t border-slate-300 pt-3">
            <Line
              label={<strong className="text-slate-800">Expected net</strong>}
              value={formatCents(netDue, currency)}
              tone={netDue >= 0n ? "good" : "bad"}
            />
          </div>
        </SummaryCard>
      </div>
    </section>
  );
});

function KpiTile({
  icon: Icon,
  label,
  value,
  footer,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  footer?: ReactNode;
}) {
  return (
    <div className="hover-card rounded-xl border border-slate-300 bg-slate-100 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{label}</p>
        <Icon size={18} className="shrink-0 text-slate-500" />
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-slate-900">{value}</p>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

export const SubscriptionKpis = memo(function SubscriptionKpis({
  subscriptions,
}: {
  subscriptions: DashboardSummary["subscriptions"];
}) {
  const { current, change, statusBreakdown } = subscriptions;
  return (
    <section aria-label="Subscriptions" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiTile
        icon={Activity}
        label="New subscriptions"
        value={current.newSubscriptions.toLocaleString("en-US")}
        footer={<ChangeBadge value={change.newSubscriptions} />}
      />
      <KpiTile
        icon={CreditCard}
        label="Paid subscriptions"
        value={current.paidSubscriptions.toLocaleString("en-US")}
        footer={<ChangeBadge value={change.paidSubscriptions} />}
      />
      <KpiTile
        icon={Users}
        label="Active now"
        value={statusBreakdown.ACTIVE.toLocaleString("en-US")}
        footer={<span className="text-xs text-slate-500">All active subscriptions</span>}
      />
      <KpiTile
        icon={Hourglass}
        label="Awaiting payment"
        value={statusBreakdown.PENDING.toLocaleString("en-US")}
        footer={<span className="text-xs text-slate-500">Pending sign-ups</span>}
      />
    </section>
  );
});
