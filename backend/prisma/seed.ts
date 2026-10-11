
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST ?? "localhost",
  port: Number(process.env.DATABASE_PORT ?? "3306"),
  user: requiredEnv("DATABASE_USER"),
  password: requiredEnv("DATABASE_PASSWORD"),
  database: process.env.DATABASE_NAME ?? "subscription_management",
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

async function main() {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const previousWeekDate = addDays(currentWeekStart, -5);

  const monthHistoryDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.min(now.getDate(), 3),
    10,
  );

  const previousMonthDate = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    3,
    10,
  );

  const currentDate = new Date(now);
  currentDate.setMilliseconds(0);

  // Create stable demo companies.
  const companyA = await prisma.company.upsert({
    where: { id: "demo-company-alpha" },
    update: {
      name: "Demo Company Alpha",
      contactName: "Alex Morgan",
      email: "alpha@example.test",
      phone: "+218 910000001",
    },
    create: {
      id: "demo-company-alpha",
      name: "Demo Company Alpha",
      contactName: "Alex Morgan",
      email: "alpha@example.test",
      phone: "+218 910000001",
    },
  });

  const companyB = await prisma.company.upsert({
    where: { id: "demo-company-beta" },
    update: {
      name: "Demo Company Beta",
      contactName: "Jordan Lee",
      email: "beta@example.test",
      phone: "+218 910000002",
    },
    create: {
      id: "demo-company-beta",
      name: "Demo Company Beta",
      contactName: "Jordan Lee",
      email: "beta@example.test",
      phone: "+218 910000002",
    },
  });

  const starter = await prisma.plan.upsert({
    where: { name: "Demo Starter" },
    update: {
      priceLYD: "500.00",
      priceUSD: "120.00",
      isActive: true,
    },
    create: {
      id: "demo-plan-starter",
      name: "Demo Starter",
      description: "Demo subscription plan",
      billingInterval: "MONTHLY",
      priceLYD: "500.00",
      priceUSD: "120.00",
      isActive: true,
    },
  });

  const business = await prisma.plan.upsert({
    where: { name: "Demo Business" },
    update: {
      priceLYD: "750.00",
      priceUSD: "200.00",
      isActive: true,
    },
    create: {
      id: "demo-plan-business",
      name: "Demo Business",
      description: "Demo business subscription plan",
      billingInterval: "MONTHLY",
      priceLYD: "750.00",
      priceUSD: "200.00",
      isActive: true,
    },
  });

  // All demo subscriptions use stable IDs, so this script can be rerun.
  const subscriptions = [
    {
      id: "demo-sub-current-lyd",
      companyId: companyA.id,
      planId: starter.id,
      amount: "500.00",
      currency: "LYD" as const,
      status: "ACTIVE" as const,
      createdAt: currentDate,
    },
    {
      id: "demo-sub-current-usd",
      companyId: companyB.id,
      planId: business.id,
      amount: "120.00",
      currency: "USD" as const,
      status: "ACTIVE" as const,
      createdAt: currentDate,
    },
    {
      id: "demo-sub-pending",
      companyId: companyA.id,
      planId: business.id,
      amount: "750.00",
      currency: "LYD" as const,
      status: "PENDING" as const,
      createdAt: currentDate,
    },
    {
      id: "demo-sub-previous-lyd",
      companyId: companyB.id,
      planId: starter.id,
      amount: "400.00",
      currency: "LYD" as const,
      status: "ACTIVE" as const,
      createdAt: previousWeekDate,
    },
    {
      id: "demo-sub-previous-usd",
      companyId: companyA.id,
      planId: starter.id,
      amount: "80.00",
      currency: "USD" as const,
      status: "ACTIVE" as const,
      createdAt: previousWeekDate,
    },
    {
      id: "demo-sub-monthly-usd",
      companyId: companyB.id,
      planId: business.id,
      amount: "90.00",
      currency: "USD" as const,
      status: "ACTIVE" as const,
      createdAt: monthHistoryDate,
    },
    {
      id: "demo-sub-last-month-lyd",
      companyId: companyA.id,
      planId: starter.id,
      amount: "300.00",
      currency: "LYD" as const,
      status: "ACTIVE" as const,
      createdAt: previousMonthDate,
    },
    {
      id: "demo-sub-last-month-usd",
      companyId: companyB.id,
      planId: business.id,
      amount: "100.00",
      currency: "USD" as const,
      status: "ACTIVE" as const,
      createdAt: previousMonthDate,
    },
  ];

  for (const item of subscriptions) {
    await prisma.subscription.upsert({
      where: { id: item.id },
      update: {
        companyId: item.companyId,
        planId: item.planId,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        createdAt: item.createdAt,
      },
      create: {
        ...item,
        startsAt: item.createdAt,
      },
    });
  }

  // Successful payments only; the pending subscription has no payment.
  const payments = [
    {
      id: "demo-pay-current-lyd",
      subscriptionId: "demo-sub-current-lyd",
      amount: "500.00",
      currency: "LYD" as const,
      method: "CASH" as const,
      paidAt: currentDate,
    },
    {
      id: "demo-pay-current-usd",
      subscriptionId: "demo-sub-current-usd",
      amount: "120.00",
      currency: "USD" as const,
      method: "INTERNATIONAL_CARD" as const,
      paidAt: currentDate,
    },
    {
      id: "demo-pay-monthly-usd",
      subscriptionId: "demo-sub-monthly-usd",
      amount: "90.00",
      currency: "USD" as const,
      method: "LOCAL_BANK_CARD" as const,
      paidAt: monthHistoryDate,
    },
    {
      id: "demo-pay-previous-lyd",
      subscriptionId: "demo-sub-previous-lyd",
      amount: "400.00",
      currency: "LYD" as const,
      method: "LOCAL_BANK_CARD" as const,
      paidAt: previousWeekDate,
    },
    {
      id: "demo-pay-previous-usd",
      subscriptionId: "demo-sub-previous-usd",
      amount: "80.00",
      currency: "USD" as const,
      method: "CASH" as const,
      paidAt: previousWeekDate,
    },
    {
      id: "demo-pay-last-month-lyd",
      subscriptionId: "demo-sub-last-month-lyd",
      amount: "300.00",
      currency: "LYD" as const,
      method: "CASH" as const,
      paidAt: previousMonthDate,
    },
    {
      id: "demo-pay-last-month-usd",
      subscriptionId: "demo-sub-last-month-usd",
      amount: "100.00",
      currency: "USD" as const,
      method: "INTERNATIONAL_CARD" as const,
      paidAt: previousMonthDate,
    },
  ];

  for (const item of payments) {
    await prisma.payment.upsert({
      where: { id: item.id },
      update: {
        subscriptionId: item.subscriptionId,
        amount: item.amount,
        currency: item.currency,
        method: item.method,
        status: "SUCCEEDED",
        paidAt: item.paidAt,
        createdAt: item.paidAt,
      },
      create: {
        ...item,
        status: "SUCCEEDED",
        createdAt: item.paidAt,
      },
    });
  }

  const expenses = [
    {
      id: "demo-exp-current-lyd",
      title: "Demo operating expense",
      amount: "100.00",
      currency: "LYD" as const,
      expenseDate: currentDate,
    },
    {
      id: "demo-exp-current-usd",
      title: "Demo software expense",
      amount: "25.00",
      currency: "USD" as const,
      expenseDate: currentDate,
    },
    {
      id: "demo-exp-previous-lyd",
      title: "Demo previous week expense",
      amount: "75.00",
      currency: "LYD" as const,
      expenseDate: previousWeekDate,
    },
    {
      id: "demo-exp-previous-usd",
      title: "Demo previous week expense",
      amount: "15.00",
      currency: "USD" as const,
      expenseDate: previousWeekDate,
    },
    {
      id: "demo-exp-last-month-lyd",
      title: "Demo previous month expense",
      amount: "60.00",
      currency: "LYD" as const,
      expenseDate: previousMonthDate,
    },
  ];

  for (const item of expenses) {
    await prisma.expense.upsert({
      where: { id: item.id },
      update: { ...item },
      create: item,
    });
  }

  const payables = [
    {
      id: "demo-payable-lyd",
      vendorName: "Demo Office Supplier",
      description: "Demo outstanding LYD bill",
      amount: "2000.00",
      amountPaid: "500.00",
      currency: "LYD" as const,
      status: "PARTIALLY_PAID" as const,
    },
    {
      id: "demo-payable-usd",
      vendorName: "Demo Software Vendor",
      description: "Demo outstanding USD bill",
      amount: "500.00",
      amountPaid: "100.00",
      currency: "USD" as const,
      status: "PARTIALLY_PAID" as const,
    },
  ];

  for (const item of payables) {
    await prisma.payable.upsert({
      where: { id: item.id },
      update: { ...item },
      create: item,
    });
  }

  console.log("Demo data seeded successfully.");
  console.log({
    companies: 2,
    plans: 2,
    subscriptions: subscriptions.length,
    payments: payments.length,
    expenses: expenses.length,
    payables: payables.length,
  });
}

main()
  .catch((error) => {
    console.error("Demo seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
