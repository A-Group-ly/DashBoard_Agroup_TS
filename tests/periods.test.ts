import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpError } from "../worker/http";
import {
  add,
  formatRange,
  localNow,
  parsePeriod,
  resolvePeriod,
  startOf,
  toSqlTimestamp,
} from "../worker/periods";

// Wednesday 14 October 2026, 20:30 (local wall-clock time)
const NOW = new Date(Date.UTC(2026, 9, 14, 20, 30, 0));
const sql = (date: Date) => toSqlTimestamp(date);

describe("calendar helpers", () => {
  it("finds period starts", () => {
    assert.equal(sql(startOf("day", NOW)), "2026-10-14 00:00:00");
    assert.equal(sql(startOf("week", NOW)), "2026-10-12 00:00:00"); // Monday
    assert.equal(sql(startOf("month", NOW)), "2026-10-01 00:00:00");
    assert.equal(sql(startOf("quarter", NOW)), "2026-10-01 00:00:00");
    assert.equal(sql(startOf("half", NOW)), "2026-07-01 00:00:00");
    assert.equal(sql(startOf("week", new Date(Date.UTC(2026, 9, 11)))), "2026-10-05 00:00:00"); // Sunday
  });

  it("clamps month arithmetic to the end of shorter months", () => {
    assert.equal(sql(add("month", new Date(Date.UTC(2026, 2, 31)), -1)), "2026-02-28 00:00:00");
    assert.equal(sql(add("quarter", new Date(Date.UTC(2026, 0, 1)), -1)), "2025-10-01 00:00:00");
  });

  it("reads the wall clock in the company time zone", () => {
    const instant = new Date("2026-10-14T18:30:00Z");
    assert.equal(sql(localNow("Africa/Tripoli", instant)), "2026-10-14 20:30:00");
    assert.equal(sql(localNow("UTC", instant)), "2026-10-14 18:30:00");
  });

  it("formats ranges compactly", () => {
    const day = new Date(Date.UTC(2026, 9, 14));
    assert.equal(formatRange(day, add("day", day, 1)), "Wed 14 Oct 2026");
    assert.equal(formatRange(new Date(Date.UTC(2026, 9, 1)), NOW), "1–14 Oct 2026");
    assert.equal(
      formatRange(new Date(Date.UTC(2026, 8, 28)), new Date(Date.UTC(2026, 9, 5))),
      "28 Sep – 4 Oct 2026",
    );
  });
});

describe("resolvePeriod", () => {
  it("compares this month to date with the same days last month", () => {
    const r = resolvePeriod("month", NOW);
    assert.equal(r.current.label, "1–14 Oct 2026");
    assert.equal(sql(r.previous.start), "2026-09-01 00:00:00");
    assert.equal(sql(r.previous.end), "2026-09-14 20:30:00");
    assert.equal(r.title, "October 2026");
    assert.equal(r.buckets.length, 12);
    assert.equal(r.buckets.at(-1)?.label, "Oct");
  });

  it("compares today with yesterday up to the same time", () => {
    const r = resolvePeriod("day", NOW);
    assert.equal(sql(r.previous.start), "2026-10-13 00:00:00");
    assert.equal(sql(r.previous.end), "2026-10-13 20:30:00");
  });

  it("compares a half-year with the same calendar point of the previous half", () => {
    const r = resolvePeriod("half", NOW);
    assert.equal(sql(r.previous.start), "2026-01-01 00:00:00");
    assert.equal(sql(r.previous.end), "2026-04-14 20:30:00");
  });

  it("handles quarters and weeks", () => {
    const q = resolvePeriod("quarter", NOW);
    assert.equal(sql(q.previous.start), "2026-07-01 00:00:00");
    assert.equal(q.title, "Q4 2026");
    const w = resolvePeriod("week", NOW);
    assert.equal(sql(w.previous.start), "2026-10-05 00:00:00");
    assert.equal(sql(w.previous.end), "2026-10-07 20:30:00");
  });

  it("compares a finished custom range with the same number of days before it", () => {
    const r = resolvePeriod("custom", NOW, { from: "2026-09-01", to: "2026-09-30" });
    assert.equal(r.isToDate, false);
    assert.equal(sql(r.current.end), "2026-10-01 00:00:00");
    assert.equal(sql(r.previous.start), "2026-08-02 00:00:00");
    assert.equal(sql(r.previous.end), "2026-09-01 00:00:00");
    assert.equal(r.bucketUnit, "day");
    assert.equal(r.buckets.length, 30);
  });

  it("picks weekly or monthly buckets for longer custom ranges", () => {
    assert.equal(resolvePeriod("custom", NOW, { from: "2026-06-01", to: "2026-09-30" }).bucketUnit, "week");
    const year = resolvePeriod("custom", NOW, { from: "2025-10-01", to: "2026-10-14" });
    assert.equal(year.bucketUnit, "month");
    assert.equal(year.isToDate, true);
    assert.equal(year.buckets[0].label, "Oct ’25");
  });

  it("rejects bad custom ranges", () => {
    const bad = (from: string, to: string) =>
      assert.throws(() => resolvePeriod("custom", NOW, { from, to }), HttpError);
    bad("2026-10-10", "2026-10-01");
    bad("2026-02-30", "2026-03-01");
    bad("2026-11-01", "2026-11-05");
    bad("2020-01-01", "2026-01-01");
    bad("yesterday", "2026-01-01");
  });

  it("accepts the old monthly/weekly values", () => {
    assert.equal(parsePeriod("monthly"), "month");
    assert.equal(parsePeriod("weekly"), "week");
    assert.equal(parsePeriod(null), "month");
    assert.throws(() => parsePeriod("yearly"), HttpError);
  });
});
