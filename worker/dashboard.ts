// Dashboard figures, computed in Postgres from the real tables.
//
// Rules (unchanged from the original NestJS service):
//   - revenue      = SUCCEEDED payments, by paid_at
//   - expenses     = expenses, by expense_date
//   - net profit   = revenue - expenses, per currency (never mixed)
//   - payables     = amount - amount_paid for UNPAID / PARTIALLY_PAID bills
//
// Everything is fetched with ONE SQL statement, so a dashboard load costs a
// single round trip to Neon.

import { can } from "../shared/permissions";
import { centsToDecimal, percentageChange, toCents } from "../shared/money";
import type {
  BreakdownItem,
  CurrentUser,
  DashboardSummary,
  FinancePeriod,
  MoneyByCurrency,
  PaymentMethod,
  RecentSubscription,
  SubscriptionStatus,
} from "../shared/types";
import type { Sql } from "./db";
import { monthEndLabel, toSqlTimestamp, type ResolvedPeriod } from "./periods";

// $1 = range starts (local), $2 = range ends (local), $3 = time zone,
// $4 = end of the current month (local).
// Range 0 = current period, 1 = previous period, 2.. = chart buckets.
export const SUMMARY_SQL = `
WITH r AS (
  SELECT (t.ord - 1)::int AS ord,
         (t.ls::timestamp AT TIME ZONE $3::text) AS s,
         (t.le::timestamp AT TIME ZONE $3::text) AS e
  FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS t(ls, le, ord)
),
cur AS (SELECT s, e FROM r WHERE ord = 0),
month_end AS (SELECT ($4::timestamp AT TIME ZONE $3::text) AS e),
pay AS (
  SELECT r.ord,
         count(DISTINCT p.subscription_id) AS paid_subs,
         count(p.id) AS payments,
         COALESCE(sum(p.amount) FILTER (WHERE p.currency = 'LYD'), 0) AS rev_lyd,
         COALESCE(sum(p.amount) FILTER (WHERE p.currency = 'USD'), 0) AS rev_usd
  FROM r
  LEFT JOIN payments p
    ON p.status = 'SUCCEEDED' AND p.paid_at >= r.s AND p.paid_at < r.e
  GROUP BY r.ord
),
exp AS (
  SELECT r.ord,
         COALESCE(sum(x.amount) FILTER (WHERE x.currency = 'LYD'), 0) AS exp_lyd,
         COALESCE(sum(x.amount) FILTER (WHERE x.currency = 'USD'), 0) AS exp_usd
  FROM r
  LEFT JOIN expenses x ON x.expense_date >= r.s AND x.expense_date < r.e
  GROUP BY r.ord
),
subs AS (
  SELECT r.ord, count(s.id) AS new_subs
  FROM r
  LEFT JOIN subscriptions s ON s.created_at >= r.s AND s.created_at < r.e
  GROUP BY r.ord
),
renewals AS (
  -- Next billing date of every active subscription
  SELECT s.currency, s.amount,
         CASE WHEN pl.billing_interval = 'MONTHLY'
           THEN s.starts_at + ((date_part('year', age(now(), s.starts_at)) * 12
                               + date_part('month', age(now(), s.starts_at)) + 1)::int) * interval '1 month'
           ELSE s.starts_at + ((date_part('year', age(now(), s.starts_at)) + 1)::int) * interval '1 year'
         END AS next_due
  FROM subscriptions s
  JOIN plans pl ON pl.id = s.plan_id
  WHERE s.status = 'ACTIVE' AND s.starts_at IS NOT NULL
)
SELECT
  (SELECT json_agg(json_build_object(
            'ord', r.ord,
            'newSubs', subs.new_subs,
            'paidSubs', pay.paid_subs,
            'payments', pay.payments,
            'revLYD', pay.rev_lyd::text,
            'revUSD', pay.rev_usd::text,
            'expLYD', exp.exp_lyd::text,
            'expUSD', exp.exp_usd::text,
            'from', to_char(r.s AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'to',   to_char(r.e AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
          ORDER BY r.ord)
     FROM r JOIN pay USING (ord) JOIN exp USING (ord) JOIN subs USING (ord)) AS ranges,

  (SELECT COALESCE(json_agg(json_build_object(
            'id', x.method, 'currency', x.currency, 'amount', x.amount::text, 'count', x.n)), '[]'::json)
     FROM (SELECT p.method::text AS method, p.currency::text AS currency, sum(p.amount) AS amount, count(*) AS n
             FROM payments p, cur
            WHERE p.status = 'SUCCEEDED' AND p.paid_at >= cur.s AND p.paid_at < cur.e
            GROUP BY 1, 2) x) AS by_method,

  (SELECT COALESCE(json_agg(json_build_object(
            'id', x.plan_id, 'label', x.plan, 'currency', x.currency, 'amount', x.amount::text, 'count', x.n)), '[]'::json)
     FROM (SELECT pl.id AS plan_id, pl.name AS plan, p.currency::text AS currency, sum(p.amount) AS amount, count(*) AS n
             FROM payments p
             JOIN subscriptions s ON s.id = p.subscription_id
             JOIN plans pl ON pl.id = s.plan_id, cur
            WHERE p.status = 'SUCCEEDED' AND p.paid_at >= cur.s AND p.paid_at < cur.e
            GROUP BY 1, 2, 3) x) AS by_plan,

  (SELECT COALESCE(json_agg(json_build_object(
            'currency', x.currency, 'total', x.total::text, 'paid', x.paid::text,
            'remaining', x.remaining::text, 'count', x.n,
            'dueRemaining', x.due_remaining::text, 'dueCount', x.due_n)), '[]'::json)
     FROM (SELECT b.currency::text AS currency,
                  sum(b.amount) AS total,
                  sum(b.amount_paid) AS paid,
                  sum(b.amount - b.amount_paid) AS remaining,
                  count(*) AS n,
                  COALESCE(sum(b.amount - b.amount_paid) FILTER (WHERE b.due_date < (SELECT e FROM month_end)), 0) AS due_remaining,
                  count(*) FILTER (WHERE b.due_date < (SELECT e FROM month_end)) AS due_n
             FROM payables b
            WHERE b.status IN ('UNPAID', 'PARTIALLY_PAID')
            GROUP BY 1) x) AS payables,

  (SELECT COALESCE(json_agg(json_build_object('currency', x.currency, 'amount', x.amount::text, 'count', x.n)), '[]'::json)
     FROM (SELECT s.currency::text AS currency, sum(s.amount) AS amount, count(*) AS n
             FROM subscriptions s
            WHERE s.status = 'PENDING'
              AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.subscription_id = s.id AND p.status = 'SUCCEEDED')
            GROUP BY 1) x) AS receivables,

  (SELECT COALESCE(json_agg(json_build_object('currency', x.currency, 'amount', x.amount::text, 'count', x.n)), '[]'::json)
     FROM (SELECT currency::text AS currency, sum(amount) AS amount, count(*) AS n
             FROM renewals
            WHERE next_due >= now() AND next_due < (SELECT e FROM month_end)
            GROUP BY 1) x) AS renewals_due,

  (SELECT COALESCE(json_agg(json_build_object('currency', x.currency, 'amount', x.amount::text)), '[]'::json)
     FROM (SELECT currency::text AS currency, sum(amount) AS amount
             FROM payments WHERE status = 'SUCCEEDED' GROUP BY 1) x) AS lifetime_paid,

  (SELECT COALESCE(json_object_agg(x.status, x.n), '{}'::json)
     FROM (SELECT status::text AS status, count(*) AS n FROM subscriptions GROUP BY 1) x) AS statuses,

  (SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.sort_at DESC), '[]'::json)
     FROM (SELECT s.id,
                  c.name AS company,
                  pl.name AS plan,
                  s.currency::text AS currency,
                  s.amount::text AS amount,
                  s.status::text AS status,
                  EXISTS (SELECT 1 FROM payments p WHERE p.subscription_id = s.id AND p.status = 'SUCCEEDED') AS paid,
                  to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt",
                  s.created_at AS sort_at
             FROM subscriptions s
             JOIN companies c ON c.id = s.company_id
             JOIN plans pl ON pl.id = s.plan_id
            ORDER BY s.created_at DESC
            LIMIT 8) x) AS recent
`;

type RangeRow = {
  ord: number;
  newSubs: number;
  paidSubs: number;
  payments: number;
  revLYD: string;
  revUSD: string;
  expLYD: string;
  expUSD: string;
  from: string;
  to: string;
};
type CurrencyRow = { currency: string; amount: string; count?: number };
type SummaryRow = {
  ranges: RangeRow[];
  by_method: (CurrencyRow & { id: string })[];
  by_plan: (CurrencyRow & { id: string; label: string })[];
  payables: {
    currency: string;
    total: string;
    paid: string;
    remaining: string;
    count: number;
    dueRemaining: string;
    dueCount: number;
  }[];
  receivables: CurrencyRow[];
  renewals_due: CurrencyRow[];
  lifetime_paid: CurrencyRow[];
  statuses: Partial<Record<SubscriptionStatus, number>>;
  recent: (Omit<RecentSubscription, "amount"> & { amount: string })[];
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  LOCAL_BANK_CARD: "Local bank card",
  INTERNATIONAL_CARD: "International card",
};

/** Runs the single summary query. Safe to start before the user's role is known. */
export async function loadSummaryData(
  sql: Sql,
  resolved: ResolvedPeriod,
  timeZone: string,
): Promise<SummaryRow> {
  const ranges = [resolved.current, resolved.previous, ...resolved.buckets];
  const [row] = await sql<SummaryRow>(SUMMARY_SQL, [
    ranges.map((range) => toSqlTimestamp(range.start)),
    ranges.map((range) => toSqlTimestamp(range.end)),
    timeZone,
    toSqlTimestamp(resolved.monthEnd),
  ]);
  if (!row?.ranges?.length) throw new Error("Summary query returned no ranges.");
  return row;
}

type Cents = { LYD: bigint; USD: bigint };
const zero = (): Cents => ({ LYD: 0n, USD: 0n });
const money = (cents: Cents): MoneyByCurrency => ({
  LYD: centsToDecimal(cents.LYD),
  USD: centsToDecimal(cents.USD),
});

function byCurrency<T extends { currency: string }>(rows: T[], pick: (row: T) => string): Cents {
  const total = zero();
  for (const row of rows) {
    if (row.currency === "LYD" || row.currency === "USD") total[row.currency] += toCents(pick(row));
  }
  return total;
}

function groupBreakdown(
  rows: (CurrencyRow & { id: string; label?: string })[],
  label: (row: CurrencyRow & { id: string; label?: string }) => string,
): BreakdownItem[] {
  const items = new Map<string, { label: string; cents: Cents; count: number }>();
  for (const row of rows) {
    const item = items.get(row.id) ?? { label: label(row), cents: zero(), count: 0 };
    if (row.currency === "LYD" || row.currency === "USD") item.cents[row.currency] += toCents(row.amount);
    item.count += Number(row.count ?? 0);
    items.set(row.id, item);
  }
  return [...items.entries()]
    .map(([id, item]) => ({ id, label: item.label, amount: money(item.cents), count: item.count }))
    .sort((a, b) => b.count - a.count);
}

export function buildSummary(
  data: SummaryRow,
  resolved: ResolvedPeriod,
  user: CurrentUser,
  generatedAt = new Date(),
): DashboardSummary {
  const showFinance = can(user.role, "finance:view");

  const ranges = data.ranges.map((row) => ({
    row,
    revenue: { LYD: toCents(row.revLYD), USD: toCents(row.revUSD) },
    expenses: { LYD: toCents(row.expLYD), USD: toCents(row.expUSD) },
  }));
  const current = ranges.find((range) => range.row.ord === 0)!;
  const previous = ranges.find((range) => range.row.ord === 1)!;
  const buckets = ranges.filter((range) => range.row.ord >= 2);

  const profit = (range: (typeof ranges)[number]): Cents => ({
    LYD: range.revenue.LYD - range.expenses.LYD,
    USD: range.revenue.USD - range.expenses.USD,
  });

  const financePeriod = (range: (typeof ranges)[number]): FinancePeriod => ({
    paymentsReceived: money(range.revenue),
    paymentsCount: range.row.payments,
    expenses: money(range.expenses),
    netProfit: money(profit(range)),
  });

  const statusBreakdown: Record<SubscriptionStatus, number> = {
    ACTIVE: data.statuses.ACTIVE ?? 0,
    PENDING: data.statuses.PENDING ?? 0,
    CANCELLED: data.statuses.CANCELLED ?? 0,
    EXPIRED: data.statuses.EXPIRED ?? 0,
  };

  const recentSubscriptions: RecentSubscription[] = data.recent.map((item) => ({
    id: item.id,
    company: item.company,
    plan: item.plan,
    currency: item.currency,
    amount: showFinance ? item.amount : null,
    status: item.status,
    paid: item.paid,
    createdAt: item.createdAt,
  }));

  let finance: DashboardSummary["finance"] = null;

  if (showFinance) {
    const payablesTotal = byCurrency(data.payables, (row) => row.total);
    const payablesPaid = byCurrency(data.payables, (row) => row.paid);
    const payablesRemaining = byCurrency(data.payables, (row) => row.remaining);
    const billsDue = byCurrency(data.payables, (row) => row.dueRemaining);
    const count = (rows: { count?: number }[]) => rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);

    finance = {
      current: financePeriod(current),
      previous: financePeriod(previous),
      change: {
        paymentsLYD: percentageChange(current.revenue.LYD, previous.revenue.LYD),
        paymentsUSD: percentageChange(current.revenue.USD, previous.revenue.USD),
        expensesLYD: percentageChange(current.expenses.LYD, previous.expenses.LYD),
        expensesUSD: percentageChange(current.expenses.USD, previous.expenses.USD),
        profitLYD: percentageChange(profit(current).LYD, profit(previous).LYD),
        profitUSD: percentageChange(profit(current).USD, profit(previous).USD),
      },
      history: buckets.map((range, index) => ({
        key: resolved.buckets[index].key,
        label: resolved.buckets[index].label,
        revenue: money(range.revenue),
        expenses: money(range.expenses),
        netProfit: money(profit(range)),
      })),
      breakdown: {
        byMethod: groupBreakdown(data.by_method, (row) => METHOD_LABELS[row.id as PaymentMethod] ?? row.id),
        byPlan: groupBreakdown(data.by_plan, (row) => row.label ?? row.id),
      },
      obligations: {
        payables: {
          total: money(payablesTotal),
          paid: money(payablesPaid),
          remaining: money(payablesRemaining),
          count: count(data.payables),
        },
        receivables: {
          remaining: money(byCurrency(data.receivables, (row) => row.amount)),
          count: count(data.receivables),
        },
      },
      dueByMonthEnd: {
        label: monthEndLabel(resolved.monthEnd),
        renewals: {
          amount: money(byCurrency(data.renewals_due, (row) => row.amount)),
          count: count(data.renewals_due),
        },
        bills: {
          amount: money(billsDue),
          count: data.payables.reduce((sum, row) => sum + Number(row.dueCount ?? 0), 0),
        },
      },
      lifetimePaid: money(byCurrency(data.lifetime_paid, (row) => row.amount)),
    };
  }

  return {
    period: resolved.period,
    generatedAt: generatedAt.toISOString(),
    title: resolved.title,
    bucketUnit: resolved.bucketUnit,
    range: {
      current: { from: current.row.from, to: current.row.to, label: resolved.current.label },
      previous: { from: previous.row.from, to: previous.row.to, label: resolved.previous.label },
      isToDate: resolved.isToDate,
    },
    subscriptions: {
      current: { newSubscriptions: current.row.newSubs, paidSubscriptions: current.row.paidSubs },
      previous: { newSubscriptions: previous.row.newSubs, paidSubscriptions: previous.row.paidSubs },
      change: {
        newSubscriptions: percentageChange(current.row.newSubs, previous.row.newSubs),
        paidSubscriptions: percentageChange(current.row.paidSubs, previous.row.paidSubs),
      },
      statusBreakdown,
      history: buckets.map((range, index) => ({
        key: resolved.buckets[index].key,
        label: resolved.buckets[index].label,
        newSubscriptions: range.row.newSubs,
      })),
    },
    recentSubscriptions,
    finance,
  };
}
