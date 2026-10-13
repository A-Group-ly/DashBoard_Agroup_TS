// Dashboard figures, computed in Postgres from the real tables.
//
// Same rules as the original NestJS service:
//   - revenue      = SUCCEEDED payments, by paid_at
//   - expenses     = expenses, by expense_date
//   - net profit   = revenue - expenses, per currency (never mixed)
//   - payables     = amount - amount_paid for UNPAID / PARTIALLY_PAID bills
// Period boundaries are calculated in the company's time zone, so "this
// month" means the Tripoli calendar month, not the server's UTC month.

import { can } from "../shared/permissions";
import { centsToDecimal, percentageChange, toCents } from "../shared/money";
import type {
  CurrentUser,
  DashboardSummary,
  FinancePeriod,
  Period,
  RecentSubscription,
  SubscriptionStatus,
} from "../shared/types";
import type { Sql } from "./db";

const HISTORY_LENGTH: Record<Period, number> = { monthly: 12, weekly: 8 };

type BucketRow = {
  idx: number;
  start_at: string;
  end_at: string;
  label: string;
  short_label: string;
  bucket_key: string;
  new_subscriptions: number;
  paid_subscriptions: number;
  revenue_lyd: string;
  revenue_usd: string;
  expenses_lyd: string;
  expenses_usd: string;
};

type Bucket = {
  row: BucketRow;
  revenueLYD: bigint;
  revenueUSD: bigint;
  expensesLYD: bigint;
  expensesUSD: bigint;
};

// One row per period, newest first. $1 = 'month' | 'week', $2 = time zone,
// $3 = number of periods. Postgres weeks start on Monday, like the original.
const BUCKETS_SQL = `
WITH anchor AS (
  SELECT date_trunc($1::text, now() AT TIME ZONE $2::text) AS local_start
),
buckets AS (
  SELECT g.i AS idx,
         a.local_start - g.i * ('1 ' || $1::text)::interval AS local_start
  FROM anchor a, generate_series(0, $3::int - 1) AS g(i)
),
b AS (
  SELECT idx,
         local_start,
         local_start AT TIME ZONE $2::text AS start_at,
         (local_start + ('1 ' || $1::text)::interval) AT TIME ZONE $2::text AS end_at
  FROM buckets
)
SELECT
  b.idx::int AS idx,
  to_char(b.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_at,
  to_char(b.end_at   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_at,
  CASE WHEN $1::text = 'month' THEN to_char(b.local_start, 'FMMonth YYYY')
       ELSE 'Week of ' || to_char(b.local_start, 'FMDD Mon YYYY') END AS label,
  CASE WHEN $1::text = 'month' THEN to_char(b.local_start, 'Mon')
       ELSE to_char(b.local_start, 'FMDD Mon') END AS short_label,
  to_char(b.local_start, 'YYYY-MM-DD') AS bucket_key,
  (SELECT count(*) FROM subscriptions s
     WHERE s.created_at >= b.start_at AND s.created_at < b.end_at)::int AS new_subscriptions,
  (SELECT count(DISTINCT p.subscription_id) FROM payments p
     WHERE p.status = 'SUCCEEDED' AND p.paid_at >= b.start_at AND p.paid_at < b.end_at)::int AS paid_subscriptions,
  (SELECT COALESCE(sum(p.amount), 0) FROM payments p
     WHERE p.status = 'SUCCEEDED' AND p.currency = 'LYD'
       AND p.paid_at >= b.start_at AND p.paid_at < b.end_at)::text AS revenue_lyd,
  (SELECT COALESCE(sum(p.amount), 0) FROM payments p
     WHERE p.status = 'SUCCEEDED' AND p.currency = 'USD'
       AND p.paid_at >= b.start_at AND p.paid_at < b.end_at)::text AS revenue_usd,
  (SELECT COALESCE(sum(e.amount), 0) FROM expenses e
     WHERE e.currency = 'LYD' AND e.expense_date >= b.start_at AND e.expense_date < b.end_at)::text AS expenses_lyd,
  (SELECT COALESCE(sum(e.amount), 0) FROM expenses e
     WHERE e.currency = 'USD' AND e.expense_date >= b.start_at AND e.expense_date < b.end_at)::text AS expenses_usd
FROM b
ORDER BY b.idx
`;

const PAYABLES_SQL = `
SELECT currency::text AS currency,
       COALESCE(sum(amount - amount_paid), 0)::text AS outstanding
FROM payables
WHERE status IN ('UNPAID', 'PARTIALLY_PAID')
GROUP BY currency
`;

const STATUS_SQL = `
SELECT status::text AS status, count(*)::int AS count
FROM subscriptions
GROUP BY status
`;

const RECENT_SQL = `
SELECT s.id,
       c.name AS company,
       pl.name AS plan,
       s.currency::text AS currency,
       s.amount::text AS amount,
       s.status::text AS status,
       EXISTS (
         SELECT 1 FROM payments p WHERE p.subscription_id = s.id AND p.status = 'SUCCEEDED'
       ) AS paid,
       to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
FROM subscriptions s
JOIN companies c ON c.id = s.company_id
JOIN plans pl ON pl.id = s.plan_id
ORDER BY s.created_at DESC
LIMIT 8
`;

export async function getDashboardSummary(
  sql: Sql,
  user: CurrentUser,
  period: Period,
  timeZone: string,
): Promise<DashboardSummary> {
  const showFinance = can(user.role, "finance:view");
  const unit = period === "monthly" ? "month" : "week";

  const [bucketRows, payableRows, statusRows, recentRows] = await Promise.all([
    sql<BucketRow>(BUCKETS_SQL, [unit, timeZone, HISTORY_LENGTH[period]]),
    showFinance
      ? sql<{ currency: string; outstanding: string }>(PAYABLES_SQL)
      : Promise.resolve([]),
    sql<{ status: SubscriptionStatus; count: number }>(STATUS_SQL),
    sql<{
      id: string;
      company: string;
      plan: string;
      currency: "LYD" | "USD";
      amount: string;
      status: SubscriptionStatus;
      paid: boolean;
      created_at: string;
    }>(RECENT_SQL),
  ]);

  const buckets: Bucket[] = bucketRows.map((row) => ({
    row,
    revenueLYD: toCents(row.revenue_lyd),
    revenueUSD: toCents(row.revenue_usd),
    expensesLYD: toCents(row.expenses_lyd),
    expensesUSD: toCents(row.expenses_usd),
  }));

  const current = buckets.find((bucket) => bucket.row.idx === 0);
  const previous = buckets.find((bucket) => bucket.row.idx === 1);
  if (!current || !previous) {
    throw new Error("Period calculation returned no rows.");
  }

  const statusBreakdown: Record<SubscriptionStatus, number> = {
    ACTIVE: 0,
    PENDING: 0,
    CANCELLED: 0,
    EXPIRED: 0,
  };
  for (const row of statusRows) statusBreakdown[row.status] = row.count;

  const recentSubscriptions: RecentSubscription[] = recentRows.map((row) => ({
    id: row.id,
    company: row.company,
    plan: row.plan,
    currency: row.currency,
    amount: showFinance ? row.amount : null,
    status: row.status,
    paid: row.paid,
    createdAt: row.created_at,
  }));

  const range = (bucket: Bucket) => ({
    from: bucket.row.start_at,
    to: bucket.row.end_at,
    label: bucket.row.label,
  });

  let finance: DashboardSummary["finance"] = null;

  if (showFinance) {
    const outstanding = { LYD: "0.00", USD: "0.00" };
    for (const row of payableRows) {
      if (row.currency === "LYD" || row.currency === "USD") {
        outstanding[row.currency] = centsToDecimal(toCents(row.outstanding));
      }
    }

    const profitLYD = (bucket: Bucket) => bucket.revenueLYD - bucket.expensesLYD;
    const profitUSD = (bucket: Bucket) => bucket.revenueUSD - bucket.expensesUSD;

    finance = {
      current: financePeriod(current),
      previous: financePeriod(previous),
      change: {
        paymentsLYD: percentageChange(current.revenueLYD, previous.revenueLYD),
        paymentsUSD: percentageChange(current.revenueUSD, previous.revenueUSD),
        profitLYD: percentageChange(profitLYD(current), profitLYD(previous)),
        profitUSD: percentageChange(profitUSD(current), profitUSD(previous)),
      },
      // Oldest first, so the chart reads left to right.
      history: [...buckets].reverse().map((bucket) => ({
        key: bucket.row.bucket_key,
        label: bucket.row.short_label,
        netProfit: {
          LYD: centsToDecimal(profitLYD(bucket)),
          USD: centsToDecimal(profitUSD(bucket)),
        },
      })),
      outstandingPayables: outstanding,
    };
  }

  return {
    period,
    generatedAt: new Date().toISOString(),
    range: { current: range(current), previous: range(previous) },
    subscriptions: {
      current: {
        newSubscriptions: current.row.new_subscriptions,
        paidSubscriptions: current.row.paid_subscriptions,
      },
      previous: {
        newSubscriptions: previous.row.new_subscriptions,
        paidSubscriptions: previous.row.paid_subscriptions,
      },
      change: {
        newSubscriptions: percentageChange(
          current.row.new_subscriptions,
          previous.row.new_subscriptions,
        ),
        paidSubscriptions: percentageChange(
          current.row.paid_subscriptions,
          previous.row.paid_subscriptions,
        ),
      },
      statusBreakdown,
    },
    recentSubscriptions,
    finance,
  };
}

function financePeriod(bucket: Bucket): FinancePeriod {
  return {
    paymentsReceived: {
      LYD: centsToDecimal(bucket.revenueLYD),
      USD: centsToDecimal(bucket.revenueUSD),
    },
    expenses: {
      LYD: centsToDecimal(bucket.expensesLYD),
      USD: centsToDecimal(bucket.expensesUSD),
    },
    netProfit: {
      LYD: centsToDecimal(bucket.revenueLYD - bucket.expensesLYD),
      USD: centsToDecimal(bucket.revenueUSD - bucket.expensesUSD),
    },
  };
}
