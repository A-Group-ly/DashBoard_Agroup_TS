// API response shapes shared by the worker and the React app.
import type { Permission, Role } from "./permissions";

/** Date filter presets; "custom" uses explicit from/to dates. */
export type Period = "day" | "week" | "month" | "quarter" | "half" | "custom";
/** Granularity of the trend charts. */
export type BucketUnit = "day" | "week" | "month" | "quarter" | "half";
export type PaymentMethod = "CASH" | "LOCAL_BANK_CARD" | "INTERNATIONAL_CARD";
export type Currency = "LYD" | "USD";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "CANCELLED" | "EXPIRED";

/** Money is always sent as an exact decimal string, e.g. "1250.00". */
export type MoneyByCurrency = { LYD: string; USD: string };

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  permissions: Permission[];
};

export type PeriodRange = {
  from: string; // ISO timestamp (inclusive)
  to: string; // ISO timestamp (exclusive)
  label: string; // e.g. "1–14 Oct 2026"
};

export type SubscriptionCounts = {
  newSubscriptions: number;
  paidSubscriptions: number;
};

export type FinancePeriod = {
  paymentsReceived: MoneyByCurrency;
  paymentsCount: number;
  expenses: MoneyByCurrency;
  netProfit: MoneyByCurrency;
};

export type HistoryPoint = {
  key: string; // bucket start date, YYYY-MM-DD
  label: string; // short axis label, e.g. "Oct" or "12 Oct"
  newSubscriptions: number;
};

export type FinanceHistoryPoint = {
  key: string;
  label: string;
  revenue: MoneyByCurrency;
  expenses: MoneyByCurrency;
  netProfit: MoneyByCurrency;
};

export type BreakdownItem = {
  id: string;
  label: string;
  amount: MoneyByCurrency;
  count: number;
};

export type RecentSubscription = {
  id: string;
  company: string;
  plan: string;
  currency: Currency;
  /** null when the viewer lacks the finance:view permission */
  amount: string | null;
  status: SubscriptionStatus;
  paid: boolean;
  createdAt: string;
};

export type DashboardSummary = {
  period: Period;
  generatedAt: string;
  /** e.g. "October 2026", "Q4 2026", "Custom range" */
  title: string;
  bucketUnit: BucketUnit;
  range: {
    current: PeriodRange;
    previous: PeriodRange;
    /** the current range ends now (period still running) */
    isToDate: boolean;
  };
  subscriptions: {
    current: SubscriptionCounts;
    previous: SubscriptionCounts;
    change: { newSubscriptions: number | null; paidSubscriptions: number | null };
    statusBreakdown: Record<SubscriptionStatus, number>;
    history: HistoryPoint[];
  };
  recentSubscriptions: RecentSubscription[];
  /** null when the viewer lacks the finance:view permission */
  finance: null | {
    current: FinancePeriod;
    previous: FinancePeriod;
    change: {
      paymentsLYD: number | null;
      paymentsUSD: number | null;
      expensesLYD: number | null;
      expensesUSD: number | null;
      profitLYD: number | null;
      profitUSD: number | null;
    };
    history: FinanceHistoryPoint[];
    breakdown: {
      /** revenue in the current range by payment method */
      byMethod: BreakdownItem[];
      /** revenue in the current range by plan */
      byPlan: BreakdownItem[];
    };
    /** money owed in both directions, as of now (not filtered by period) */
    obligations: {
      /** bills A-Group still owes suppliers */
      payables: { total: MoneyByCurrency; paid: MoneyByCurrency; remaining: MoneyByCurrency; count: number };
      /** customers who signed up but have not paid yet */
      receivables: { remaining: MoneyByCurrency; count: number };
    };
    /** what should move between now and the end of the current month */
    dueByMonthEnd: {
      label: string; // e.g. "31 Oct"
      renewals: { amount: MoneyByCurrency; count: number };
      bills: { amount: MoneyByCurrency; count: number };
    };
    /** all successful payments ever received */
    lifetimePaid: MoneyByCurrency;
  };
};

export type TeamMember = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};

export type ApiError = { error: string; message: string };

/**
 * TV / wallboard view. Aggregates only: it never carries customer names,
 * emails, phone numbers, invoice ids or individual transactions, because it
 * is shown on shared screens.
 */
export type WallboardSummary = {
  generatedAt: string;
  timeZone: string;
  /** true while the database still holds the sample (demo-*) records */
  demoData: boolean;
  /** e.g. "October 2026" */
  monthTitle: string;
  range: { current: string; previous: string };
  /** ISO timestamps (end exclusive) so screens can format dates in any language */
  rangeIso: { current: { from: string; to: string }; previous: { from: string; to: string } };
  subscriptions: {
    active: number;
    pending: number;
    cancelled: number;
    expired: number;
    /** companies with at least one subscription */
    customers: number;
    newThisMonth: number;
    newChange: number | null;
    /** card payments that failed in the last 30 days */
    failedPayments30d: number;
    renewalsNext7Days: { total: number; byDay: { date: string; count: number }[] };
    /** new subscriptions per month, oldest first */
    newHistory: { key: string; label: string; value: number }[];
  };
  /** null when the viewer's role cannot see money */
  finance: null | {
    collected: MoneyByCurrency;
    collectedChange: { LYD: number | null; USD: number | null };
    /** monthly recurring revenue: active monthly plans + yearly plans / 12 */
    mrr: MoneyByCurrency;
    receivables: { amount: MoneyByCurrency; count: number };
    payables: { remaining: MoneyByCurrency; count: number };
    dueByMonthEnd: { label: string; renewals: MoneyByCurrency; bills: MoneyByCurrency; billsCount: number };
    /** payments received and expenses per month, oldest first */
    history: { key: string; label: string; revenue: MoneyByCurrency; expenses: MoneyByCurrency }[];
  };
};
