// API response shapes shared by the worker and the React app.
import type { Permission, Role } from "./permissions";

export type Period = "monthly" | "weekly";
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
  label: string; // e.g. "October 2026" or "Week of 12 Oct"
};

export type SubscriptionCounts = {
  newSubscriptions: number;
  paidSubscriptions: number;
};

export type FinancePeriod = {
  paymentsReceived: MoneyByCurrency;
  expenses: MoneyByCurrency;
  netProfit: MoneyByCurrency;
};

export type ProfitHistoryPoint = {
  key: string;
  label: string;
  netProfit: MoneyByCurrency;
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
  range: { current: PeriodRange; previous: PeriodRange };
  subscriptions: {
    current: SubscriptionCounts;
    previous: SubscriptionCounts;
    change: { newSubscriptions: number | null; paidSubscriptions: number | null };
    statusBreakdown: Record<SubscriptionStatus, number>;
  };
  recentSubscriptions: RecentSubscription[];
  /** null when the viewer lacks the finance:view permission */
  finance: null | {
    current: FinancePeriod;
    previous: FinancePeriod;
    change: {
      paymentsLYD: number | null;
      paymentsUSD: number | null;
      profitLYD: number | null;
      profitUSD: number | null;
    };
    history: ProfitHistoryPoint[];
    outstandingPayables: MoneyByCurrency;
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
