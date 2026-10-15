import { memo, useState } from "react";

import { compactNumber, labelStride, niceScale, useChartWidth } from "./scale";
import { ChartTooltip, EmptyChart, Legend } from "./shared";

export type LineSeries = { id: string; label: string; color: string; values: number[] };

/**
 * Multi-series line chart with a crosshair: hover (or tap) anywhere over a
 * period to see every series' value for it.
 */
export const LineChart = memo(function LineChart({
  labels,
  series,
  format,
  ariaLabel,
  height: fixedHeight,
  textSize = 11,
  showLegend = true,
}: {
  labels: string[];
  series: LineSeries[];
  format: (value: number) => string;
  ariaLabel: string;
  /** Fixed chart height in px (TV mode); defaults to 240/300. */
  height?: number;
  /** Axis label size in px; margins grow with it (TV mode uses ~18-26). */
  textSize?: number;
  showLegend?: boolean;
}) {
  const { ref, width } = useChartWidth();
  const [active, setActive] = useState<number | null>(null);

  const all = series.flatMap((item) => item.values);
  if (labels.length === 0 || all.length === 0) {
    return (
      <div ref={ref}>
        <EmptyChart>No data for this range yet.</EmptyChart>
      </div>
    );
  }

  const { low, high, ticks } = niceScale(Math.min(...all), Math.max(...all));
  const compact = width < 520;
  const k = textSize / 11;
  const height = fixedHeight ?? (compact ? 240 : 300);
  const left = Math.round((compact ? 40 : 52) * k);
  const right = 24;
  const top = 12;
  const bottom = Math.round(30 * k);
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const step = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;
  const xAt = (index: number) => left + (labels.length > 1 ? index * step : plotWidth / 2);
  const yAt = (value: number) => top + ((high - value) / (high - low)) * plotHeight;
  const stride = labelStride(step || plotWidth, (compact ? 40 : 48) * k);

  const pathFor = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`).join(" ");

  const pick = (clientX: number, target: SVGSVGElement) => {
    const box = target.getBoundingClientRect();
    const x = clientX - box.left;
    const index = labels.length > 1 ? Math.round((x - left) / step) : 0;
    setActive(Math.min(labels.length - 1, Math.max(0, index)));
  };

  return (
    <div>
      <div ref={ref} className="relative">
        {active !== null && (
          <ChartTooltip
            x={xAt(active)}
            containerWidth={width}
            title={labels[active]}
            rows={series.map((item) => ({ label: item.label, value: format(item.values[active]), color: item.color }))}
          />
        )}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="block max-w-full touch-pan-y"
          onPointerMove={(event) => pick(event.clientX, event.currentTarget)}
          onPointerDown={(event) => pick(event.clientX, event.currentTarget)}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke="var(--chart-grid)"
                strokeDasharray={tick === 0 ? undefined : "3 5"}
              />
              <text x={left - 8} y={yAt(tick) + textSize * 0.35} textAnchor="end" fontSize={textSize} fill="var(--chart-ink)">
                {compactNumber(tick)}
              </text>
            </g>
          ))}

          {labels.map((label, index) =>
            index % stride === (labels.length - 1) % stride ? (
              <text
                key={label + index}
                x={xAt(index)}
                y={height - Math.round(8 * k)}
                textAnchor="middle"
                fontSize={textSize}
                fontWeight={index === active ? 700 : 400}
                fill="var(--chart-ink)"
              >
                {label}
              </text>
            ) : null,
          )}

          {active !== null && (
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={top}
              y2={top + plotHeight}
              stroke="var(--chart-axis)"
              strokeWidth="1"
            />
          )}

          {series.map((item) => (
            <g key={item.id}>
              <path d={pathFor(item.values)} fill="none" stroke={item.color} strokeWidth={Math.max(2, Math.round(textSize / 6))} strokeLinejoin="round" strokeLinecap="round" />
              {active !== null && (
                <circle
                  cx={xAt(active)}
                  cy={yAt(item.values[active])}
                  r={Math.max(5, Math.round(textSize / 3))}
                  fill={item.color}
                  stroke="var(--chart-surface)"
                  strokeWidth="2"
                />
              )}
            </g>
          ))}
        </svg>
      </div>
      {showLegend && (<div className="mt-3">
        <Legend items={series.map((item) => ({ label: item.label, color: item.color, shape: "line" }))} />
      </div>)}
    </div>
  );
});
