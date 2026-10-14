import { COMPANY_TIME_ZONE } from "./format";

/** Today's date in Tripoli as YYYY-MM-DD. */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: COMPANY_TIME_ZONE }).format(new Date());
}

export function daysAgo(days: number): string {
  const [y, m, d] = todayLocal().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}
