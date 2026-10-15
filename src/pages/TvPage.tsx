import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  Expand,
  Info,
  Languages,
  LoaderCircle,
  Moon,
  Shrink,
  Sun,
  TriangleAlert,
  WifiOff,
  X,
} from "lucide-react";

import { toCents } from "../../shared/money";
import type { Currency, MoneyByCurrency, WallboardSummary } from "../../shared/types";
import { BrandMark } from "../components/BrandMark";
import { BarChart } from "../components/charts/BarChart";
import { DonutChart } from "../components/charts/DonutChart";
import { LineChart } from "../components/charts/LineChart";
import { COMPANY_TIME_ZONE } from "../lib/format";
import { navigate } from "../lib/router";
import type { Theme } from "../lib/theme";
import { TV_STRINGS, format, type TvKey, type TvLang } from "../lib/tvStrings";
import { useNow, useWallboard } from "../lib/useWallboard";
import "../tv.css";

// ---------------------------------------------------------------------------
// Settings (URL: /tv?refresh=60&dwell=20&lang=ar)

const LANG_KEY = "a-group-tv-lang";

function readSettings() {
  const params = new URLSearchParams(window.location.search);
  const clamp = (value: string | null, min: number, max: number, fallback: number) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.min(max, Math.max(min, number)) : fallback;
  };
  let lang: TvLang = "en";
  const fromUrl = params.get("lang");
  if (fromUrl === "ar" || fromUrl === "en") lang = fromUrl;
  else {
    try {
      if (window.localStorage.getItem(LANG_KEY) === "ar") lang = "ar";
    } catch {
      // ignore
    }
  }
  return {
    refreshMs: clamp(params.get("refresh"), 15, 600, 60) * 1000,
    dwellMs: clamp(params.get("dwell"), 10, 120, 20) * 1000,
    lang,
  };
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// Same chart colours as the dashboard (they switch with light/dark mode).
const SERIES_1 = "var(--chart-1)";
const SERIES_2 = "var(--chart-2)";

// ---------------------------------------------------------------------------

export function TvPage({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const [settings] = useState(readSettings);
  const [lang, setLang] = useState<TvLang>(settings.lang);
  const t = useCallback(
    (key: TvKey, values?: Record<string, string | number>) => format(TV_STRINGS[lang][key], values),
    [lang],
  );
  const { data, lastSuccessAt, error, loading } = useWallboard(settings.refreshMs);
  const fullscreen = useFullscreen();
  const cursorHidden = useIdleCursor(4000);

  const exitTv = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    navigate("/");
  }, []);

  // Escape leaves TV mode. In full screen the browser uses Escape to leave
  // full screen first, which we simply follow via `fullscreenchange`.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) exitTv();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitTv]);

  function toggleLang() {
    const next: TvLang = lang === "en" ? "ar" : "en";
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // ignore
    }
  }

  const locale = lang === "ar" ? "ar-LY-u-nu-latn" : "en-GB";

  return (
    <div
      className={`tv-root app-shell ${cursorHidden ? "tv-cursor-hidden" : ""}`}
      data-theme={theme}
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
    >
      <TvHeader
        t={t}
        locale={locale}
        lang={lang}
        data={data}
        lastSuccessAt={lastSuccessAt}
        error={error}
        loading={loading}
        refreshMs={settings.refreshMs}
        fullscreen={fullscreen}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleLang={toggleLang}
        onExit={exitTv}
      />

      {!data ? (
        <main className="tv-empty" aria-busy={loading}>
          {error ? <CircleAlert aria-hidden="true" /> : <LoaderCircle className="animate-spin" aria-hidden="true" />}
          <p>{error ? t("loadFailed") : t("loading")}</p>
        </main>
      ) : (
        <TvBody data={data} t={t} locale={locale} dwellMs={settings.dwellMs} userCanSeeMoney={data.finance !== null} />
      )}

    </div>
  );
}

type T = (key: TvKey, values?: Record<string, string | number>) => string;

// ---------------------------------------------------------------------------
// Header: brand, title, clock, freshness, status, controls

function TvHeader({
  t,
  locale,
  lang,
  data,
  lastSuccessAt,
  error,
  loading,
  refreshMs,
  fullscreen,
  theme,
  onToggleTheme,
  onToggleLang,
  onExit,
}: {
  t: T;
  locale: string;
  lang: TvLang;
  data: WallboardSummary | null;
  lastSuccessAt: number | null;
  error: Error | null;
  loading: boolean;
  refreshMs: number;
  fullscreen: ReturnType<typeof useFullscreen>;
  theme: Theme;
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onExit: () => void;
}) {
  const now = useNow(15_000);
  const timeZone = data?.timeZone ?? COMPANY_TIME_ZONE;
  const clock = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const date = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const updated = lastSuccessAt
    ? new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(lastSuccessAt)
    : "—";

  // Status: live, stale (no success for 2.5 intervals) or offline (last try failed).
  const signedOut = error && "status" in error && (error as { status?: number }).status === 401;
  const stale = lastSuccessAt !== null && now - lastSuccessAt > refreshMs * 2.5;
  let status: { tone: "ok" | "warn"; icon: ReactNode; text: string };
  if (signedOut) status = { tone: "warn", icon: <CircleAlert aria-hidden="true" />, text: t("signedOut") };
  else if (error && lastSuccessAt) status = { tone: "warn", icon: <WifiOff aria-hidden="true" />, text: t("offline", { time: updated }) };
  else if (stale) status = { tone: "warn", icon: <TriangleAlert aria-hidden="true" />, text: t("stale", { time: updated }) };
  else if (!lastSuccessAt) status = { tone: "ok", icon: <LoaderCircle className="animate-spin" aria-hidden="true" />, text: t("loading") };
  else status = { tone: "ok", icon: <CircleCheck aria-hidden="true" />, text: `${t("live")} · ${t("updated", { time: updated })}` };

  return (
    <header className="tv-header">
      <div className="tv-brand">
        <BrandMark size={44} className="tv-brand-mark" />
        <div>
          <p className="tv-eyebrow">A-GROUP</p>
          <h1 className="tv-title">{t("title")}</h1>
        </div>
        {data?.demoData && (
          <span className="tv-demo" title={t("demo")}>
            <Info aria-hidden="true" /> {t("demo")}
          </span>
        )}
      </div>

      <div className="tv-clock" aria-label={`${date} ${clock}`}>
        <span className="tv-clock-time">
          <bdi>{clock}</bdi>
        </span>
        <span className="tv-clock-date">{date}</span>
      </div>

      <div className="tv-header-end">
        <p className={`tv-status tv-status-${status.tone}`} role="status" aria-live="polite" aria-busy={loading}>
          {status.icon}
          <span>{status.text}</span>
        </p>
        <div className="tv-controls">
          <button
            type="button"
            className="tv-control tv-control-icon"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? t("lightMode") : t("darkMode")}
            title={theme === "dark" ? t("lightMode") : t("darkMode")}
          >
            {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button type="button" className="tv-control" onClick={onToggleLang} aria-label={t("languageLabel")} title={t("languageLabel")}>
            <Languages aria-hidden="true" />
            <span lang={lang === "en" ? "ar" : "en"}>{t("language")}</span>
          </button>
          {fullscreen.supported && (
            <button
              type="button"
              className="tv-control"
              onClick={fullscreen.toggle}
              aria-pressed={fullscreen.active}
              title={fullscreen.active ? t("exitFullscreen") : t("fullscreen")}
            >
              {fullscreen.active ? <Shrink aria-hidden="true" /> : <Expand aria-hidden="true" />}
              <span>{fullscreen.active ? t("exitFullscreen") : t("fullscreen")}</span>
            </button>
          )}
          <button type="button" className="tv-control" onClick={onExit} title={`${t("exitTv")} (Esc)`}>
            <X aria-hidden="true" />
            <span>{t("exitTv")}</span>
          </button>
        </div>
        {fullscreen.failed && <p className="tv-hint">{t("fullscreenUnavailable")}</p>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Body: KPI band + rotating charts + attention panel

const TvBody = memo(function TvBody({
  data,
  t,
  locale,
  dwellMs,
  userCanSeeMoney,
}: {
  data: WallboardSummary;
  t: T;
  locale: string;
  dwellMs: number;
  userCanSeeMoney: boolean;
}) {
  const subs = data.subscriptions;
  const finance = data.finance;
  const n = (value: number) => value.toLocaleString("en-US");

  return (
    <main className="tv-main">
      <p className="tv-range">
        <strong>{monthTitle(data, locale)}</strong> ·{" "}
        {t("monthToDate", {
          range: rangeLabel(data.rangeIso.current, data.timeZone, locale),
          previous: rangeLabel(data.rangeIso.previous, data.timeZone, locale),
        })}
      </p>

      <section className="tv-kpis" aria-label="Key figures">
        {finance ? (
          <>
            <Kpi label={t("collected")} value={<Money value={finance.collected} primary="LYD" />} footer={<Change value={finance.collectedChange.LYD} t={t} />} />
            <Kpi label={t("mrr")} value={<Money value={finance.mrr} primary="LYD" />} footer={<span>{t("mrrHint")}</span>} />
            <Kpi label={t("active")} value={n(subs.active)} footer={<span>{t("customers", { n: n(subs.customers) })}</span>} />
            <Kpi
              label={t("owed")}
              value={<Money value={finance.receivables.amount} primary="LYD" />}
              footer={<span>{t("owedHint", { n: n(finance.receivables.count) })}</span>}
            />
          </>
        ) : (
          <>
            <Kpi label={t("newSubs")} value={n(subs.newThisMonth)} footer={<Change value={subs.newChange} t={t} />} />
            <Kpi label={t("active")} value={n(subs.active)} footer={<span>{t("customers", { n: n(subs.customers) })}</span>} />
            <Kpi label={t("pending")} value={n(subs.pending)} footer={<span>{t("pendingHint")}</span>} />
          </>
        )}
        <Kpi label={t("renewals7")} value={n(subs.renewalsNext7Days.total)} footer={<span>{t("renewals7Hint")}</span>} />
        <Kpi
          label={t("failed30")}
          value={n(subs.failedPayments30d)}
          warn={subs.failedPayments30d > 0}
          footer={<span>{t("failedHint")}</span>}
        />
      </section>

      <div className="tv-grid">
        <ChartCarousel data={data} t={t} dwellMs={dwellMs} />
        <aside className="tv-side">
          <Attention data={data} t={t} locale={locale} />
          <RenewalsWeek data={data} t={t} locale={locale} />
          {!userCanSeeMoney && <p className="tv-note">{t("financeHidden")}</p>}
        </aside>
      </div>
    </main>
  );
});

function Kpi({
  label,
  value,
  footer,
  warn = false,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  warn?: boolean;
}) {
  return (
    <div className={`tv-kpi ${warn ? "tv-kpi-warn" : ""}`}>
      <p className="tv-kpi-label">
        {warn && <TriangleAlert aria-hidden="true" />}
        {label}
      </p>
      <p className="tv-kpi-value">{value}</p>
      {footer && <div className="tv-kpi-footer">{footer}</div>}
    </div>
  );
}

/** Whole units, LYD large and USD underneath; the two are never added. */
function Money({ value, primary }: { value: MoneyByCurrency; primary: Currency }) {
  const secondary: Currency = primary === "LYD" ? "USD" : "LYD";
  return (
    <>
      <bdi className="tv-money">
        {whole(value[primary])}
        <span className="tv-currency">{primary}</span>
      </bdi>
      <bdi className="tv-money-secondary">
        {whole(value[secondary])} <span>{secondary}</span>
      </bdi>
    </>
  );
}

function monthTitle(data: WallboardSummary, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: data.timeZone, month: "long", year: "numeric" }).format(
    new Date(data.rangeIso.current.from),
  );
}

/** "1–15 Oct 2026" in the screen's language (end is exclusive, so step back a second). */
function rangeLabel(range: { from: string; to: string }, timeZone: string, locale: string): string {
  const from = new Date(range.from);
  const to = new Date(new Date(range.to).getTime() - 1000);
  return new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", year: "numeric" }).formatRange(from, to);
}

function whole(decimal: string): string {
  const cents = toCents(decimal);
  const units = Number(cents / 100n);
  return units.toLocaleString("en-US");
}

function Change({ value, t }: { value: number | null; t: T }) {
  if (value === null) return <span>{t("noBaseline")}</span>;
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  const sign = rounded > 0 ? "▲ +" : rounded < 0 ? "▼ −" : "■ ";
  return (
    <span className={rounded > 0 ? "tv-up" : rounded < 0 ? "tv-down" : ""}>
      <bdi>
        {sign}
        {Math.abs(rounded).toFixed(1)}%
      </bdi>{" "}
      {t("vsLastMonth")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Rotating charts (read-only, aggregated)

type Slide = { id: string; title: string; render: (size: { width: number; height: number }) => ReactNode };

function ChartCarousel({ data, t, dwellMs }: { data: WallboardSummary; t: T; dwellMs: number }) {
  const subs = data.subscriptions;
  const finance = data.finance;
  const { ref, size } = useElementSize<HTMLDivElement>();
  const textSize = Math.round(Math.min(44, Math.max(14, size.width / 62)));
  const formatWhole = (currency: Currency) => (value: number) =>
    currency === "LYD" ? `${Math.round(value).toLocaleString("en-US")} LYD` : `$${Math.round(value).toLocaleString("en-US")}`;

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    if (finance) {
      for (const currency of ["LYD", "USD"] as const) {
        list.push({
          id: `revenue-${currency}`,
          title: t("slideRevenue", { currency }),
          render: ({ height }) => (
            <LineChart
              ariaLabel={t("slideRevenue", { currency })}
              labels={finance.history.map((point) => point.label)}
              format={formatWhole(currency)}
              height={height}
              textSize={textSize}
              showLegend={false}
              series={[
                { id: "payments", label: t("payments"), color: SERIES_1, values: finance.history.map((p) => Number(p.revenue[currency])) },
                { id: "expenses", label: t("expenses"), color: SERIES_2, values: finance.history.map((p) => Number(p.expenses[currency])) },
              ]}
            />
          ),
        });
      }
    }
    list.push({
      id: "new-subs",
      title: t("slideNewSubs"),
      render: ({ height }) => (
        <BarChart
          ariaLabel={t("slideNewSubs")}
          labels={subs.newHistory.map((point) => point.label)}
          values={subs.newHistory.map((point) => point.value)}
          format={(value) => value.toLocaleString("en-US")}
          seriesLabel={t("newSubscriptions")}
          color={SERIES_1}
          height={height}
          textSize={textSize}
          showLegend={false}
        />
      ),
    });
    list.push({
      id: "status",
      title: t("slideStatus"),
      render: ({ width, height }) => (
        <div className="tv-donut">
          <DonutChart
            title={t("slideStatus")}
            hideTitle
            centerLabel={t("total")}
            size={Math.max(160, Math.min(height, width * 0.45))}
            textSize={textSize}
            format={(value) => value.toLocaleString("en-US")}
            slices={[
              { id: "ACTIVE", label: t("ACTIVE"), value: subs.active, color: "var(--status-active)" },
              { id: "PENDING", label: t("PENDING"), value: subs.pending, color: "var(--status-pending)" },
              { id: "CANCELLED", label: t("CANCELLED"), value: subs.cancelled, color: "var(--status-cancelled)" },
              { id: "EXPIRED", label: t("EXPIRED"), value: subs.expired, color: "var(--status-expired)" },
            ]}
          />
        </div>
      ),
    });
    return list;
  }, [finance, subs, t, textSize]);

  const [index, setIndex] = useState(0);
  const current = index % slides.length;
  const [reduceMotion] = useState(prefersReducedMotion);

  // Advance after the dwell time; paused while the tab is hidden and when
  // the viewer asked for reduced motion.
  useEffect(() => {
    if (reduceMotion || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setIndex((value) => (value + 1) % slides.length);
    }, dwellMs);
    return () => window.clearTimeout(timer);
  }, [current, dwellMs, reduceMotion, slides.length]);

  const slide = slides[current];
  const legend = slide.id.startsWith("revenue")
    ? [
        { label: t("payments"), color: SERIES_1 },
        { label: t("expenses"), color: SERIES_2 },
      ]
    : [];

  return (
    <section className="tv-panel tv-chart-panel" aria-roledescription="carousel" aria-label={slide.title}>
      <div className="tv-panel-head">
        <h2 className="tv-panel-title">{slide.title}</h2>
        <div className="tv-legend">
          {legend.map((item) => (
            <span key={item.label}>
              <i style={{ background: item.color }} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
        {slides.length > 1 && (
          <div className="tv-dots" role="tablist" aria-label="Charts">
            {slides.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={t("slideOf", { i: i + 1, n: slides.length, title: item.title })}
                className={i === current ? "is-active" : ""}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
      {/* Charts keep a left-to-right time axis in both languages. */}
      <div ref={ref} className="tv-chart-area" dir="ltr">
        <div className="tv-slide" key={slide.id}>
          {size.height > 0 && slide.render(size)}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Attention list and renewals this week (aggregated only)

function Attention({ data, t, locale }: { data: WallboardSummary; t: T; locale: string }) {
  const subs = data.subscriptions;
  const finance = data.finance;
  const items: { tone: "warn" | "info"; text: ReactNode }[] = [];

  if (subs.failedPayments30d > 0) items.push({ tone: "warn", text: t("alertFailed", { n: subs.failedPayments30d }) });
  if (subs.pending > 0) items.push({ tone: "warn", text: t("alertPending", { n: subs.pending }) });
  if (finance && finance.dueByMonthEnd.billsCount > 0) {
    items.push({
      tone: "info",
      text: (
        <>
          {t("alertBills", { n: finance.dueByMonthEnd.billsCount, date: dayMonth(data, locale) })}
          <br />
          <MoneyInline value={finance.dueByMonthEnd.bills} />
        </>
      ),
    });
  }
  if (subs.renewalsNext7Days.total === 0) items.push({ tone: "info", text: t("alertNoRenewals") });

  return (
    <section className="tv-panel" aria-labelledby="tv-attention">
      <h2 id="tv-attention" className="tv-panel-title">
        {t("attention")}
      </h2>
      {items.length === 0 ? (
        <p className="tv-ok">
          <CircleCheck aria-hidden="true" /> {t("allClear")}
        </p>
      ) : (
        <ul className="tv-alerts">
          {items.map((item, i) => (
            <li key={i} className={`tv-alert tv-alert-${item.tone}`}>
              {item.tone === "warn" ? <TriangleAlert aria-hidden="true" /> : <Info aria-hidden="true" />}
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}

      {finance && (
        <dl className="tv-due">
          <div>
            <dt>{t("debts")}</dt>
            <dd>
              <MoneyInline value={finance.payables.remaining} />
            </dd>
          </div>
          <div>
            <dt>
              {t("renewalsIn")} · {t("dueBy", { date: dayMonth(data, locale) })}
            </dt>
            <dd>
              <MoneyInline value={finance.dueByMonthEnd.renewals} />
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function MoneyInline({ value }: { value: MoneyByCurrency }) {
  return (
    <bdi className="tv-money-inline">
      {whole(value.LYD)} LYD · {whole(value.USD)} USD
    </bdi>
  );
}

function dayMonth(data: WallboardSummary, locale: string): string {
  if (!data.finance) return "";
  // "31 Oct" from the API is English; rebuild it for Arabic.
  if (!locale.startsWith("ar")) return data.finance.dueByMonthEnd.label;
  const now = new Date(data.generatedAt);
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 12));
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(last);
}

function RenewalsWeek({ data, t, locale }: { data: WallboardSummary; t: T; locale: string }) {
  const days = data.subscriptions.renewalsNext7Days.byDay;
  const max = Math.max(1, ...days.map((day) => day.count));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section className="tv-panel" aria-labelledby="tv-renewals">
      <h2 id="tv-renewals" className="tv-panel-title">
        {t("renewalsWeek")}
      </h2>
      <ul className="tv-week">
        {days.map((day, i) => (
          <li key={day.date}>
            <span className="tv-week-day">{i === 0 ? t("today") : weekday.format(new Date(`${day.date}T12:00:00Z`))}</span>
            <span className="tv-week-bar" aria-hidden="true">
              <i style={{ width: `${(day.count / max) * 100}%` }} />
            </span>
            <span className="tv-week-count">{day.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hooks

function useFullscreen() {
  const supported = typeof document !== "undefined" && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
  const [active, setActive] = useState(() => !!document.fullscreenElement);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const update = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggle = useCallback(() => {
    setFailed(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      // Only on an explicit click: browsers refuse full screen without one.
      document.documentElement.requestFullscreen().catch(() => setFailed(true));
    }
  }, []);

  return { supported, active, failed, toggle };
}

/** Hides the mouse pointer after a few idle seconds (a TV has nobody pointing). */
function useIdleCursor(idleMs: number): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let timer = window.setTimeout(() => setHidden(true), idleMs);
    const wake = () => {
      setHidden(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHidden(true), idleMs);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [idleMs]);
  return hidden;
}

function useElementSize<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSize({ width: Math.floor(element.clientWidth), height: Math.floor(element.clientHeight) }),
      );
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return { ref, size };
}
