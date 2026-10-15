// TV / wallboard figures.
//
// Built from the same verified calculations as the dashboard (this month to
// date, compared with the same point last month), plus a few wallboard-only
// aggregates. Only totals and counts leave this file: no customer names,
// contact details, invoice ids or single transactions.

import { can } from "../shared/permissions";
import { centsToDecimal, toCents } from "../shared/money";
import type { CurrentUser, MoneyByCurrency, WallboardSummary } from "../shared/types";
import { buildSummary, loadSummaryData } from "./dashboard";
import type { Sql } from "./db";
import { localNow, resolvePeriod } from "./periods";

// $1 = company time zone
export const WALLBOARD_SQL = `
WITH today AS (
  SELECT date_trunc('day', now() AT TIME ZONE $1::text) AS d
),
renewals AS (
  SELECT CASE WHEN pl.billing_interval = 'MONTHLY'
           THEN s.starts_at + ((date_part('year', age(now(), s.starts_at)) * 12
                               + date_part('month', age(now(), s.starts_at)) + 1)::int) * interval '1 month'
           ELSE s.starts_at + ((date_part('year', age(now(), s.starts_at)) + 1)::int) * interval '1 year'
         END AS next_due
  FROM subscriptions s
  JOIN plans pl ON pl.id = s.plan_id
  WHERE s.status = 'ACTIVE' AND s.starts_at IS NOT NULL
)
SELECT
  (SELECT count(*) FROM companies c
    WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id = c.id))::int AS customers,

  (SELECT count(*) FROM payments
    WHERE status = 'FAILED' AND created_at >= now() - interval '30 days')::int AS failed_30d,

  (SELECT COALESCE(json_agg(json_build_object('currency', x.currency, 'amount', x.amount)), '[]'::json)
     FROM (SELECT s.currency::text AS currency,
                  round(sum(CASE WHEN pl.billing_interval = 'MONTHLY' THEN s.amount ELSE s.amount / 12 END), 2)::text AS amount
             FROM subscriptions s
             JOIN plans pl ON pl.id = s.plan_id
            WHERE s.status = 'ACTIVE'
            GROUP BY 1) x) AS mrr,

  (SELECT json_agg(json_build_object('date', to_char(g.d, 'YYYY-MM-DD'), 'count', g.n) ORDER BY g.d)
     FROM (SELECT day.d, count(r.next_due)::int AS n
             FROM (SELECT (SELECT d FROM today) + i * interval '1 day' AS d
                     FROM generate_series(0, 6) AS i) day
             LEFT JOIN renewals r
               ON r.next_due >= now()
              AND date_trunc('day', r.next_due AT TIME ZONE $1::text) = day.d
            GROUP BY day.d) g) AS renewals_week,

  EXISTS (SELECT 1 FROM subscriptions WHERE id LIKE 'demo-%') AS demo_data
`;

type WallboardRow = {
  customers: number;
  failed_30d: number;
  mrr: { currency: string; amount: string }[];
  renewals_week: { date: string; count: number }[];
  demo_data: boolean;
};

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function getWallboard(
  sql: Sql,
  user: CurrentUser,
  timeZone: string,
): Promise<WallboardSummary> {
  const now = localNow(timeZone);
  const month = resolvePeriod("month", now);

  // Same single-round-trip summary the dashboard uses, plus one small query.
  const [summaryData, [extra]] = await Promise.all([
    loadSummaryData(sql, month, timeZone),
    sql<WallboardRow>(WALLBOARD_SQL, [timeZone]),
  ]);
  const summary = buildSummary(summaryData, month, user);
  const showFinance = can(user.role, "finance:view") && summary.finance !== null;

  const mrr: MoneyByCurrency = { LYD: "0.00", USD: "0.00" };
  for (const row of extra.mrr) {
    if (row.currency === "LYD" || row.currency === "USD") {
      mrr[row.currency] = centsToDecimal(toCents(row.amount));
    }
  }

  const subs = summary.subscriptions;
  const renewalsByDay = extra.renewals_week ?? [];

  let finance: WallboardSummary["finance"] = null;
  if (showFinance && summary.finance) {
    const f = summary.finance;
    finance = {
      collected: f.current.paymentsReceived,
      collectedChange: { LYD: f.change.paymentsLYD, USD: f.change.paymentsUSD },
      mrr,
      receivables: { amount: f.obligations.receivables.remaining, count: f.obligations.receivables.count },
      payables: { remaining: f.obligations.payables.remaining, count: f.obligations.payables.count },
      dueByMonthEnd: {
        label: f.dueByMonthEnd.label,
        renewals: f.dueByMonthEnd.renewals.amount,
        bills: f.dueByMonthEnd.bills.amount,
        billsCount: f.dueByMonthEnd.bills.count,
      },
      history: f.history.map((point) => ({
        key: point.key,
        label: point.label,
        revenue: point.revenue,
        expenses: point.expenses,
      })),
    };
  }

  return {
    generatedAt: summary.generatedAt,
    timeZone,
    demoData: extra.demo_data,
    monthTitle: `${MONTHS_LONG[month.current.start.getUTCMonth()]} ${month.current.start.getUTCFullYear()}`,
    range: { current: summary.range.current.label, previous: summary.range.previous.label },
    rangeIso: {
      current: { from: summary.range.current.from, to: summary.range.current.to },
      previous: { from: summary.range.previous.from, to: summary.range.previous.to },
    },
    subscriptions: {
      active: subs.statusBreakdown.ACTIVE,
      pending: subs.statusBreakdown.PENDING,
      cancelled: subs.statusBreakdown.CANCELLED,
      expired: subs.statusBreakdown.EXPIRED,
      customers: extra.customers,
      newThisMonth: subs.current.newSubscriptions,
      newChange: subs.change.newSubscriptions,
      failedPayments30d: extra.failed_30d,
      renewalsNext7Days: {
        total: renewalsByDay.reduce((sum, day) => sum + day.count, 0),
        byDay: renewalsByDay,
      },
      newHistory: subs.history.map((point) => ({ key: point.key, label: point.label, value: point.newSubscriptions })),
    },
    finance,
  };
}
