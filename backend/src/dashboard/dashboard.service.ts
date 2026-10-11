
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Period = "monthly" | "weekly";

type DateRange = {
  start: Date;
  end: Date;
};

type PeriodStats = {
  newSubscriptions: number;
  paidSubscriptions: number;
  revenueLYD: bigint;
  revenueUSD: bigint;
  expensesLYD: bigint;
  expensesUSD: bigint;
};

function getRanges(period: Period) {
  const now = new Date();
  let start: Date;
  let end: Date;
  let previousStart: Date;
  let previousEnd: Date;

  if (period === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousEnd = start;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setHours(0, 0, 0, 0);

    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);

    end = new Date(start);
    end.setDate(end.getDate() + 7);

    previousEnd = start;
    previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - 7);
  }

  return {
    current: { start, end },
    previous: { start: previousStart, end: previousEnd },
  };
}

// Convert database decimal amounts to integer cents to avoid
// floating-point arithmetic when calculating financial totals.
function toCents(value: { toString(): string } | null | undefined): bigint {
  if (value == null) return BigInt(0);

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.toString());

  if (!match) {
    throw new Error("Invalid monetary amount returned by the database.");
  }

  const whole = BigInt(match[2]);
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0").slice(0, 2));
  const amount = whole * BigInt(100) + fraction;

  return match[1] === "-" ? -amount : amount;
}

function formatMoney(cents: bigint): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  const whole = absolute / BigInt(100);
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

function percentageChange(
  current: number | bigint,
  previous: number | bigint,
): number | null {
  const currentNumber = Number(current);
  const previousNumber = Number(previous);

  if (previousNumber === 0) {
    return currentNumber === 0 ? 0 : null;
  }

  return Math.round(
    ((currentNumber - previousNumber) / Math.abs(previousNumber)) * 1000,
  ) / 10;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPeriodStats(range: DateRange): Promise<PeriodStats> {
    const dateFilter = {
      gte: range.start,
      lt: range.end,
    };

    const [
      newSubscriptions,
      paidSubscriptionGroups,
      lydPayments,
      usdPayments,
      lydExpenses,
      usdExpenses,
    ] = await Promise.all([
      this.prisma.subscription.count({
        where: { createdAt: dateFilter },
      }),

      this.prisma.payment.groupBy({
        by: ["subscriptionId"],
        where: {
          status: "SUCCEEDED",
          paidAt: dateFilter,
        },
      }),

      this.prisma.payment.aggregate({
        where: {
          status: "SUCCEEDED",
          currency: "LYD",
          paidAt: dateFilter,
        },
        _sum: { amount: true },
      }),

      this.prisma.payment.aggregate({
        where: {
          status: "SUCCEEDED",
          currency: "USD",
          paidAt: dateFilter,
        },
        _sum: { amount: true },
      }),

      this.prisma.expense.aggregate({
        where: {
          currency: "LYD",
          expenseDate: dateFilter,
        },
        _sum: { amount: true },
      }),

      this.prisma.expense.aggregate({
        where: {
          currency: "USD",
          expenseDate: dateFilter,
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      newSubscriptions,
      paidSubscriptions: paidSubscriptionGroups.length,
      revenueLYD: toCents(lydPayments._sum.amount),
      revenueUSD: toCents(usdPayments._sum.amount),
      expensesLYD: toCents(lydExpenses._sum.amount),
      expensesUSD: toCents(usdExpenses._sum.amount),
    };
  }

  private async getOutstandingPayables(currency: "LYD" | "USD") {
    const result = await this.prisma.payable.aggregate({
      where: {
        currency,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      _sum: {
        amount: true,
        amountPaid: true,
      },
    });

    const total = toCents(result._sum.amount);
    const paid = toCents(result._sum.amountPaid);

    return formatMoney(total - paid);
  }

  private presentStats(range: DateRange, stats: PeriodStats) {
    return {
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      newSubscriptions: stats.newSubscriptions,
      paidSubscriptions: stats.paidSubscriptions,
      paymentsReceived: {
        LYD: formatMoney(stats.revenueLYD),
        USD: formatMoney(stats.revenueUSD),
      },
      expenses: {
        LYD: formatMoney(stats.expensesLYD),
        USD: formatMoney(stats.expensesUSD),
      },
      netProfit: {
        LYD: formatMoney(stats.revenueLYD - stats.expensesLYD),
        USD: formatMoney(stats.revenueUSD - stats.expensesUSD),
      },
    };
  }

  async getSummary(period: Period) {
    const ranges = getRanges(period);

    const [
      currentStats,
      previousStats,
      payablesLYD,
      payablesUSD,
    ] = await Promise.all([
      this.getPeriodStats(ranges.current),
      this.getPeriodStats(ranges.previous),
      this.getOutstandingPayables("LYD"),
      this.getOutstandingPayables("USD"),
    ]);

    return {
      period,
      current: this.presentStats(ranges.current, currentStats),
      previous: this.presentStats(ranges.previous, previousStats),

      comparison: {
        newSubscriptions: percentageChange(
          currentStats.newSubscriptions,
          previousStats.newSubscriptions,
        ),
        paidSubscriptions: percentageChange(
          currentStats.paidSubscriptions,
          previousStats.paidSubscriptions,
        ),
        paymentsLYD: percentageChange(
          currentStats.revenueLYD,
          previousStats.revenueLYD,
        ),
        paymentsUSD: percentageChange(
          currentStats.revenueUSD,
          previousStats.revenueUSD,
        ),
      },

      outstandingPayables: {
        LYD: payablesLYD,
        USD: payablesUSD,
      },
    };
  }
}
