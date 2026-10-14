// Reporting periods and their "equivalent previous period".
//
// All maths here is on wall-clock time in the company's time zone. Dates are
// held in JS Date objects whose UTC fields ARE the local wall-clock values
// ("naive" local times); Postgres turns them into real instants with
// `AT TIME ZONE`, so daylight-saving rules are applied by the database.

import type { BucketUnit, Period } from "../shared/types";
import { HttpError } from "./http";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

/** How many buckets the trend charts show for each preset period. */
const HISTORY_LENGTH: Record<BucketUnit, number> = {
  day: 14,
  week: 12,
  month: 12,
  quarter: 6,
  half: 4,
};

export const PERIODS: readonly Period[] = ["day", "week", "month", "quarter", "half", "custom"];

export type Range = { start: Date; end: Date };
export type Bucket = Range & { key: string; label: string };

export type ResolvedPeriod = {
  period: Period;
  title: string;
  /** true when the current range stops at "now" (period still in progress) */
  isToDate: boolean;
  current: Range & { label: string };
  previous: Range & { label: string };
  bucketUnit: BucketUnit;
  buckets: Bucket[];
  monthEnd: Date;
};

// ---------------------------------------------------------------------------
// Local "now"

export function localNow(timeZone: string, instant = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")));
}

// ---------------------------------------------------------------------------
// Calendar helpers (UTC fields = local wall clock)

export function startOf(unit: BucketUnit, date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  switch (unit) {
    case "day":
      return new Date(Date.UTC(y, m, d));
    case "week": {
      const day = new Date(Date.UTC(y, m, d));
      const sinceMonday = (day.getUTCDay() + 6) % 7;
      return new Date(day.getTime() - sinceMonday * DAY_MS);
    }
    case "month":
      return new Date(Date.UTC(y, m, 1));
    case "quarter":
      return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
    case "half":
      return new Date(Date.UTC(y, m < 6 ? 0 : 6, 1));
  }
}

export function add(unit: BucketUnit, date: Date, amount: number): Date {
  if (unit === "day") return new Date(date.getTime() + amount * DAY_MS);
  if (unit === "week") return new Date(date.getTime() + amount * 7 * DAY_MS);

  const months = unit === "month" ? amount : unit === "quarter" ? amount * 3 : amount * 6;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  // Clamp the day so 31 Mar - 1 month = 28/29 Feb, not 3 Mar.
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      y,
      m,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ),
  );
}

/** "2026-10-14 13:05:00" - what Postgres receives. */
export function toSqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Labels

export function formatRange(start: Date, end: Date): string {
  const last = new Date(end.getTime() - 1000); // end is exclusive
  const sy = start.getUTCFullYear();
  const ey = last.getUTCFullYear();
  const sm = start.getUTCMonth();
  const em = last.getUTCMonth();
  const sd = start.getUTCDate();
  const ed = last.getUTCDate();

  if (sy === ey && sm === em && sd === ed) {
    return `${WEEKDAYS[start.getUTCDay()]} ${sd} ${MONTHS[sm]} ${sy}`;
  }
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm]} – ${ed} ${MONTHS[em]} ${sy}`;
  return `${sd} ${MONTHS[sm]} ${sy} – ${ed} ${MONTHS[em]} ${ey}`;
}

function bucketLabel(unit: BucketUnit, start: Date, multiYear: boolean): string {
  const y2 = String(start.getUTCFullYear()).slice(2);
  const month = MONTHS[start.getUTCMonth()];
  switch (unit) {
    case "day":
    case "week":
      return `${start.getUTCDate()} ${month}`;
    case "month":
      return multiYear ? `${month} ’${y2}` : month;
    case "quarter":
      return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ’${y2}`;
    case "half":
      return `H${start.getUTCMonth() < 6 ? 1 : 2} ’${y2}`;
  }
}

function presetTitle(unit: BucketUnit, start: Date): string {
  const y = start.getUTCFullYear();
  switch (unit) {
    case "day":
      return "Today";
    case "week":
      return "This week";
    case "month":
      return `${MONTHS_LONG[start.getUTCMonth()]} ${y}`;
    case "quarter":
      return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${y}`;
    case "half":
      return `${start.getUTCMonth() < 6 ? "First" : "Second"} half of ${y}`;
  }
}

// ---------------------------------------------------------------------------

function parseDate(value: string | null, name: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    throw new HttpError(400, "bad_request", `${name} must be a date like 2026-10-01.`);
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (isoDate(date) !== value) {
    throw new HttpError(400, "bad_request", `${name} is not a real calendar date.`);
  }
  return date;
}

export function parsePeriod(value: string | null): Period {
  // Older links used "monthly" / "weekly".
  if (value === null || value === "" || value === "monthly") return "month";
  if (value === "weekly") return "week";
  if ((PERIODS as readonly string[]).includes(value)) return value as Period;
  throw new HttpError(
    400,
    "bad_request",
    "period must be one of day, week, month, quarter, half or custom.",
  );
}

/**
 * Works out the current range, the equivalent previous range and the chart
 * buckets.
 *
 * Preset periods are compared "to date": on 14 October, "month" compares
 * 1–14 Oct with 1–14 Sep (not with the whole of September), so a period that
 * is still running is never compared against a finished one.
 * Custom ranges are compared with the same number of days just before them.
 */
export function resolvePeriod(
  period: Period,
  now: Date,
  custom?: { from: string | null; to: string | null },
): ResolvedPeriod {
  const monthEnd = add("month", startOf("month", now), 1);

  if (period !== "custom") {
    const unit: BucketUnit = period;
    const start = startOf(unit, now);
    const end = new Date(Math.max(now.getTime(), start.getTime() + 1000));
    // Same point in the previous period: 14 Oct 20:30 -> 14 Sep 20:30.
    const previousStart = add(unit, start, -1);
    const previousEnd = new Date(Math.min(add(unit, end, -1).getTime(), start.getTime()));

    const count = HISTORY_LENGTH[unit];
    const buckets: Bucket[] = [];
    for (let index = count - 1; index >= 0; index -= 1) {
      const bucketStart = add(unit, start, -index);
      buckets.push({
        start: bucketStart,
        end: add(unit, bucketStart, 1),
        key: isoDate(bucketStart),
        label: bucketLabel(unit, bucketStart, false),
      });
    }

    return {
      period,
      title: presetTitle(unit, start),
      isToDate: true,
      current: { start, end, label: formatRange(start, end) },
      previous: { start: previousStart, end: previousEnd, label: formatRange(previousStart, previousEnd) },
      bucketUnit: unit,
      buckets,
      monthEnd,
    };
  }

  // Custom range: inclusive dates
  const from = parseDate(custom?.from ?? null, "from");
  const to = parseDate(custom?.to ?? null, "to");
  if (to < from) {
    throw new HttpError(400, "bad_request", "The end date must be on or after the start date.");
  }
  if (to.getTime() - from.getTime() > 3 * 366 * DAY_MS) {
    throw new HttpError(400, "bad_request", "Custom ranges can cover at most three years.");
  }
  if (from.getTime() > now.getTime()) {
    throw new HttpError(400, "bad_request", "The start date is in the future.");
  }

  const start = from;
  const fullEnd = new Date(to.getTime() + DAY_MS);
  const isToDate = fullEnd.getTime() > now.getTime();
  const end = isToDate ? new Date(Math.max(now.getTime(), start.getTime() + 1000)) : fullEnd;
  const length = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - length);

  const days = length / DAY_MS;
  const unit: BucketUnit = days <= 45 ? "day" : days <= 26 * 7 ? "week" : "month";
  const multiYear = start.getUTCFullYear() !== end.getUTCFullYear();
  const buckets: Bucket[] = [];
  for (let cursor = startOf(unit, start); cursor < end && buckets.length < 60; cursor = add(unit, cursor, 1)) {
    const bucketStart = new Date(Math.max(cursor.getTime(), start.getTime()));
    const bucketEnd = new Date(Math.min(add(unit, cursor, 1).getTime(), end.getTime()));
    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      key: isoDate(bucketStart),
      label: bucketLabel(unit, bucketStart, multiYear),
    });
  }

  return {
    period,
    title: "Custom range",
    isToDate,
    current: { start, end, label: formatRange(start, end) },
    previous: { start: previousStart, end: start, label: formatRange(previousStart, start) },
    bucketUnit: unit,
    buckets,
    monthEnd,
  };
}

export function monthEndLabel(monthEnd: Date): string {
  const last = new Date(monthEnd.getTime() - DAY_MS);
  return `${last.getUTCDate()} ${MONTHS[last.getUTCMonth()]}`;
}
