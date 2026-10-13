import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";

import type { Currency, ProfitHistoryPoint } from "../../shared/types";
import { money } from "../lib/format";

/**
 * Profit / loss column chart. It measures its own width and draws in real
 * pixels, so text stays readable on a phone instead of shrinking.
 */
export function ProfitChart({
  points,
  currency,
  periodWord,
}: {
  points: ProfitHistoryPoint[];
  currency: Currency;
  periodWord: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    // ResizeObserver also fires once right away with the initial size.
    const observer = new ResizeObserver(() => {
      setWidth(Math.max(260, Math.floor(element.clientWidth)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = points.map((point) => {
    const value = Number(point.netProfit[currency]);
    return Number.isFinite(value) ? value : 0;
  });

  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const step = niceStep((rawMax - rawMin || 1) / 4);
  const minValue = Math.floor(rawMin / step) * step;
  const maxValue = Math.max(Math.ceil(rawMax / step) * step, minValue + step);

  const compact = width < 520;
  const height = compact ? 260 : 340;
  const left = compact ? 44 : 60;
  const right = 8;
  const top = 16;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const yAt = (value: number) => top + ((maxValue - value) / (maxValue - minValue)) * chartHeight;
  const zeroY = yAt(0);
  const slotWidth = chartWidth / Math.max(points.length, 1);
  const barWidth = Math.max(6, Math.min(40, slotWidth * 0.6));
  const labelEvery = slotWidth < 34 ? 2 : 1;
  const ticks: number[] = [];
  for (let tick = minValue; tick <= maxValue + step / 2; tick += step) ticks.push(tick);

  const highlighted = active ?? (points.length ? points.length - 1 : null);
  const highlightedPoint = highlighted !== null ? points[highlighted] : null;

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={22} className="text-slate-700" />
            <h2 className="font-display text-lg font-bold text-slate-900">Profit performance</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {currency === "LYD" ? "Libyan Dinar" : "US Dollar"} · last {points.length} {periodWord}
          </p>
        </div>

        {highlightedPoint && (
          <div className="rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-right">
            <p className="text-xs text-slate-600">{highlightedPoint.label}</p>
            <p
              className={`font-display text-sm font-bold ${
                Number(highlightedPoint.netProfit[currency]) < 0 ? "text-rose-800" : "text-slate-900"
              }`}
            >
              {money(highlightedPoint.netProfit[currency], currency)}
            </p>
          </div>
        )}
      </div>

      <div ref={containerRef} className="mt-4 flex-1">
        {points.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 p-4 text-center text-sm text-slate-600">
            No historical profit data is available yet.
          </div>
        ) : (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Profit and loss column chart in ${currency}`}
            className="block max-w-full"
            onMouseLeave={() => setActive(null)}
          >
            {ticks.map((tick, index) => (
              <g key={index}>
                <line
                  x1={left}
                  y1={yAt(tick)}
                  x2={width - right}
                  y2={yAt(tick)}
                  stroke="#cbd5e1"
                  strokeDasharray="4 5"
                />
                <text x={left - 8} y={yAt(tick) + 4} textAnchor="end" fontSize="11" fill="#475569">
                  {tick.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}
                </text>
              </g>
            ))}

            <line x1={left} y1={zeroY} x2={width - right} y2={zeroY} stroke="#64748b" strokeWidth="1.5" />

            {points.map((point, index) => {
              const value = values[index];
              const valueY = yAt(value);
              const barHeight = Math.max(2, Math.abs(zeroY - valueY));
              const slotX = left + index * slotWidth;
              const x = slotX + (slotWidth - barWidth) / 2;
              const y = Math.min(zeroY, valueY);
              const isActive = index === highlighted;

              return (
                <g
                  key={point.key}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => setActive(index)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Wide invisible hit area so bars are easy to tap on phones */}
                  <rect x={slotX} y={top} width={slotWidth} height={chartHeight} fill="transparent" />
                  <rect
                    className={value < 0 ? "profit-bar-negative" : "profit-bar-positive"}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    opacity={isActive ? 1 : 0.72}
                  >
                    <title>
                      {point.label}: {money(point.netProfit[currency], currency)}
                    </title>
                  </rect>
                  {index % labelEvery === (points.length - 1) % labelEvery && (
                    <text
                      x={slotX + slotWidth / 2}
                      y={height - 12}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isActive ? 700 : 400}
                      fill="#475569"
                    >
                      {point.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-300 pt-4 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          Profit
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" />
          Loss
        </span>
        <span className="ml-auto hidden sm:inline">Hover or tap a bar for details</span>
      </div>
    </section>
  );
}

/** Rounds a raw step to 1, 2, 2.5 or 5 x 10^n so axis labels are round numbers. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}
