import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ChartColumn, ChartLine, ChartPie, Users } from "lucide-react";

import type { Currency, DashboardSummary, SubscriptionStatus } from "../../../shared/types";
import { BarChart } from "./BarChart";
import { DonutChart, type DonutSlice } from "./DonutChart";
import { LineChart } from "./LineChart";

type Tab = "trend" | "profit" | "mix" | "subscriptions";

const TABS: { id: Tab; label: string; icon: typeof ChartLine; finance: boolean }[] = [
  { id: "trend", label: "Revenue & expenses", icon: ChartLine, finance: true },
  { id: "profit", label: "Net profit", icon: ChartColumn, finance: true },
  { id: "mix", label: "Revenue mix", icon: ChartPie, finance: true },
  { id: "subscriptions", label: "Subscriptions", icon: Users, finance: false },
];

/** How long each chart stays on screen during the slideshow. */
const SLIDE_MS = 8000;
/** After someone touches a chart on a phone, wait this long before rotating again. */
const TOUCH_RESUME_MS = 12000;

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

const STATUS: { id: SubscriptionStatus; label: string; color: string }[] = [
  { id: "ACTIVE", label: "Active", color: "var(--status-active)" },
  { id: "PENDING", label: "Pending", color: "var(--status-pending)" },
  { id: "CANCELLED", label: "Cancelled", color: "var(--status-cancelled)" },
  { id: "EXPIRED", label: "Expired", color: "var(--status-expired)" },
];

const UNIT_WORD: Record<DashboardSummary["bucketUnit"], string> = {
  day: "day",
  week: "week",
  month: "month",
  quarter: "quarter",
  half: "half-year",
};

/**
 * One place for every chart, organised in tabs so the page stays short and
 * every chart has the same frame, legend and hover behaviour.
 */
export const ChartsSection = memo(function ChartsSection({
  summary,
  currency,
}: {
  summary: DashboardSummary;
  currency: Currency;
}) {
  const finance = summary.finance;
  const tabs = TABS.filter((tab) => !tab.finance || finance);
  const [selected, setSelected] = useState<Tab>(tabs[0].id);
  const tab = tabs.some((item) => item.id === selected) ? selected : tabs[0].id;
  const index = tabs.findIndex((item) => item.id === tab);

  // ---- Slideshow -----------------------------------------------------------
  // Rotates through the charts on its own. It pauses while the mouse is over
  // the charts, while keyboard focus is inside, for a while after a touch,
  // and while the browser tab is hidden. People who ask their device for
  // reduced motion are not auto-rotated.
  // No play/pause button: everyone gets the slideshow, except people who ask
  // their device for reduced motion (they switch charts with the tabs).
  const [playing] = useState(prefersMotion);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touchHold, setTouchHold] = useState(false);
  const pageVisible = usePageVisible();
  const [direction, setDirection] = useState<1 | -1>(1);
  const [cycle, setCycle] = useState(0); // restarts the progress bar
  const tablistRef = useRef<HTMLDivElement>(null);
  const touchTimer = useRef<number | undefined>(undefined);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const canRotate = tabs.length > 1;
  const running = canRotate && playing && !hovered && !focused && !touchHold && pageVisible;

  function go(step: number) {
    const next = (index + step + tabs.length) % tabs.length;
    setDirection(step >= 0 ? 1 : -1);
    setSelected(tabs[next].id);
    setCycle((value) => value + 1);
  }

  function choose(id: Tab) {
    const next = tabs.findIndex((item) => item.id === id);
    setDirection(next >= index ? 1 : -1);
    setSelected(id);
    setCycle((value) => value + 1);
  }

  function holdAfterTouch() {
    setTouchHold(true);
    window.clearTimeout(touchTimer.current);
    touchTimer.current = window.setTimeout(() => setTouchHold(false), TOUCH_RESUME_MS);
  }

  useEffect(() => () => window.clearTimeout(touchTimer.current), []);

  // Keep the active tab visible in the (horizontally scrolling) tab row on
  // phones, without ever scrolling the page itself.
  useEffect(() => {
    const list = tablistRef.current;
    const button = list?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!list || !button) return;
    const left = button.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + button.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 8), behavior: "smooth" });
    }
  }, [tab]);

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
    else return;
    event.preventDefault();
  }

  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
    holdAfterTouch();
  }

  function onTouchEnd(event: TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || !canRotate) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }

  const formatMoney = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (value: number) =>
      currency === "LYD" ? `${formatter.format(value)} LYD` : `$${formatter.format(value)}`;
  }, [currency]);
  const formatCount = (value: number) => value.toLocaleString("en-US");

  const labels = (finance?.history ?? summary.subscriptions.history).map((point) => point.label);
  const caption = `By ${UNIT_WORD[summary.bucketUnit]} · ${currency === "LYD" ? "Libyan dinar" : "US dollar"}`;

  return (
    <section
      aria-labelledby="charts-heading"
      aria-roledescription="carousel"
      className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-sm"
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
      // Pause for keyboard focus only; a mouse click also focuses the tab
      // button, and that should not stop the slideshow for good.
      onFocus={(event) => setFocused((event.target as HTMLElement).matches(":focus-visible"))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="flex flex-col gap-3 border-b border-slate-300 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="charts-heading" className="font-display text-lg font-bold text-slate-900">
            Charts
          </h2>
          <p className="text-sm text-slate-600">
            {tab === "mix" ? `${summary.range.current.label} · ${currency}` : tab === "subscriptions" ? `By ${UNIT_WORD[summary.bucketUnit]}` : caption}
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="Chart type"
            onKeyDown={onTabKey}
            className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-1 lg:pb-0"
          >
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  data-tab={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => choose(item.id)}
                  className={`relative flex shrink-0 items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active
                      ? "border-slate-700 bg-slate-700 text-white"
                      : "border-slate-300 bg-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-300 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                  {active && canRotate && playing && (
                    <span
                      key={cycle}
                      aria-hidden="true"
                      className="slide-progress"
                      style={{
                        animationDuration: `${SLIDE_MS}ms`,
                        animationPlayState: running ? "running" : "paused",
                      }}
                      onAnimationEnd={() => go(1)}
                    />
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      <div
        role="tabpanel"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${tabs.length}: ${tabs[index].label}`}
        aria-live={running ? "off" : "polite"}
        className={`p-4 sm:p-6 ${direction === 1 ? "slide-in-next" : "slide-in-prev"}`}
        key={`${tab}-${currency}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {tab === "trend" && finance && (
          <LineChart
            ariaLabel={`Revenue and expenses in ${currency}`}
            labels={labels}
            format={formatMoney}
            series={[
              {
                id: "revenue",
                label: "Payments received",
                color: SERIES_COLORS[0],
                values: finance.history.map((point) => Number(point.revenue[currency])),
              },
              {
                id: "expenses",
                label: "Expenses",
                color: SERIES_COLORS[1],
                values: finance.history.map((point) => Number(point.expenses[currency])),
              },
            ]}
          />
        )}

        {tab === "profit" && finance && (
          <BarChart
            ariaLabel={`Net profit in ${currency}`}
            labels={labels}
            values={finance.history.map((point) => Number(point.netProfit[currency]))}
            format={formatMoney}
            seriesLabel="Net profit"
            signed
          />
        )}

        {tab === "mix" && finance && (
          <div className="grid gap-8 lg:grid-cols-2">
            <DonutChart
              title="By payment method"
              centerLabel="Total"
              format={formatMoney}
              slices={toSlices(finance.breakdown.byMethod, currency)}
            />
            <DonutChart
              title="By plan"
              centerLabel="Total"
              format={formatMoney}
              slices={toSlices(finance.breakdown.byPlan, currency)}
            />
          </div>
        )}

        {tab === "subscriptions" && (
          <div className="grid gap-8 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">New subscriptions</h3>
              <BarChart
                ariaLabel="New subscriptions per period"
                labels={summary.subscriptions.history.map((point) => point.label)}
                values={summary.subscriptions.history.map((point) => point.newSubscriptions)}
                format={formatCount}
                seriesLabel="New subscriptions"
              />
            </div>
            <div className="min-w-0 xl:col-span-2">
            <DonutChart
              title="All subscriptions by status"
              centerLabel="Total"
              format={formatCount}
              slices={STATUS.map((status) => ({
                id: status.id,
                label: status.label,
                color: status.color,
                value: summary.subscriptions.statusBreakdown[status.id],
              }))}
            />
            </div>
          </div>
        )}
      </div>

      {canRotate && (
        <div className="flex items-center justify-center gap-2 pb-4" aria-hidden="true">
          {tabs.map((item) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                item.id === tab ? "w-6 bg-slate-700" : "w-1.5 bg-slate-400"
              }`}
            />
          ))}
          <span className="ml-2 text-xs text-slate-500">
            {!playing ? "Use the tabs to switch charts" : running ? "Auto-playing" : "Paused while you look"}
          </span>
        </div>
      )}
    </section>
  );
});

function prefersMotion(): boolean {
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function toSlices(
  items: NonNullable<DashboardSummary["finance"]>["breakdown"]["byMethod"],
  currency: Currency,
): DonutSlice[] {
  // Colour follows the entity (a fixed order by id), never its rank, so a
  // method keeps its colour when you switch currency or date range.
  const known = ["CASH", "LOCAL_BANK_CARD", "INTERNATIONAL_CARD"];
  const ids = items.map((item) => item.id);
  const colorOrder = ids.every((id) => known.includes(id)) ? known : [...ids].sort();
  return items
    .map((item) => ({ item, value: Number(item.amount[currency]) }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value)
    .map(({ item, value }) => ({
      id: item.id,
      label: item.label,
      value,
      color: SERIES_COLORS[colorOrder.indexOf(item.id)] ?? "var(--chart-axis)",
    }));
}
