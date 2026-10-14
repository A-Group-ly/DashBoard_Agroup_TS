import { useState } from "react";
import { CalendarRange, Check } from "lucide-react";

import type { Period } from "../../shared/types";
import { todayLocal } from "../lib/dates";
import type { DashboardFilter } from "../lib/useDashboardSummary";

const OPTIONS: { id: Period; label: string; short: string }[] = [
  { id: "day", label: "Daily", short: "Day" },
  { id: "week", label: "Weekly", short: "Week" },
  { id: "month", label: "Monthly", short: "Month" },
  { id: "quarter", label: "Quarterly", short: "Quarter" },
  { id: "half", label: "Semiannual", short: "6 months" },
  { id: "custom", label: "Custom range", short: "Custom" },
];

export function PeriodPicker({
  value,
  onChange,
}: {
  value: DashboardFilter;
  onChange: (filter: DashboardFilter) => void;
}) {
  const [draftFrom, setDraftFrom] = useState(value.from);
  const [draftTo, setDraftTo] = useState(value.to);
  const today = todayLocal();
  const draftInvalid = !draftFrom || !draftTo || draftFrom > draftTo;
  const draftChanged = draftFrom !== value.from || draftTo !== value.to;

  function select(period: Period) {
    onChange({ ...value, period });
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Phones: a native select is easier to use than six buttons */}
      <label className="sr-only" htmlFor="period-select">
        Date range
      </label>
      <select
        id="period-select"
        value={value.period}
        onChange={(event) => select(event.target.value as Period)}
        className="h-11 rounded-xl border border-slate-300 bg-slate-200 px-3 text-sm font-semibold text-slate-800 hover:border-slate-400 md:hidden"
      >
        {OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Tablets and up: segmented control */}
      <div
        role="radiogroup"
        aria-label="Date range"
        className="hidden flex-wrap rounded-xl border border-slate-300 bg-slate-200 p-1 md:flex"
      >
        {OPTIONS.map((option) => {
          const active = value.period === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => select(option.id)}
              title={option.label}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
                active ? "bg-slate-700 text-white shadow-sm" : "text-slate-700 hover:bg-slate-300 hover:text-slate-900"
              }`}
            >
              {option.id === "custom" && <CalendarRange size={15} />}
              {option.short}
            </button>
          );
        })}
      </div>

      {value.period === "custom" && (
        <form
          className="pop-in flex flex-wrap items-end gap-2 rounded-xl border border-slate-300 bg-slate-100 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draftInvalid) onChange({ period: "custom", from: draftFrom, to: draftTo });
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
            From
            <input
              type="date"
              value={draftFrom}
              max={today}
              onChange={(event) => setDraftFrom(event.target.value)}
              className="h-10 min-w-[9.5rem] rounded-lg border border-slate-300 bg-slate-200 px-2 text-sm font-medium text-slate-900 hover:border-slate-400"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
            To
            <input
              type="date"
              value={draftTo}
              min={draftFrom}
              onChange={(event) => setDraftTo(event.target.value)}
              className="h-10 min-w-[9.5rem] rounded-lg border border-slate-300 bg-slate-200 px-2 text-sm font-medium text-slate-900 hover:border-slate-400"
            />
          </label>
          <button
            type="submit"
            disabled={draftInvalid || !draftChanged}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} /> Apply
          </button>
          {draftFrom > draftTo && draftFrom && draftTo && (
            <p className="w-full text-xs text-rose-800">The end date must be on or after the start date.</p>
          )}
        </form>
      )}
    </div>
  );
}
