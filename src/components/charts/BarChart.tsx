import { memo, useState } from "react";

import { compactNumber, labelStride, niceScale, useChartWidth } from "./scale";
import { ChartTooltip, EmptyChart, Legend } from "./shared";

/**
 * Column chart. With `signed`, positive bars use the profit colour and
 * negative bars the loss colour, anchored on a zero baseline.
 */
export const BarChart = memo(function BarChart({
  labels,
  values,
  format,
  ariaLabel,
  seriesLabel,
  color = "var(--chart-1)",
  signed = false,
}: {
  labels: string[];
  values: number[];
  format: (value: number) => string;
  ariaLabel: string;
  seriesLabel: string;
  color?: string;
  signed?: boolean;
}) {
  const { ref, width } = useChartWidth();
  const [active, setActive] = useState<number | null>(null);

  if (values.length === 0) {
    return (
      <div ref={ref}>
        <EmptyChart>No data for this range yet.</EmptyChart>
      </div>
    );
  }

  const { low, high, ticks } = niceScale(Math.min(...values), Math.max(...values));
  const compact = width < 520;
  const height = compact ? 240 : 300;
  const left = compact ? 40 : 52;
  const right = 8;
  const top = 12;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const slot = plotWidth / values.length;
  const barWidth = Math.max(4, Math.min(36, slot * 0.62));
  const yAt = (value: number) => top + ((high - value) / (high - low)) * plotHeight;
  const zeroY = yAt(0);
  const stride = labelStride(slot, compact ? 40 : 48);
  const barColor = (value: number) =>
    signed ? (value < 0 ? "var(--chart-negative)" : "var(--chart-positive)") : color;

  return (
    <div>
      <div ref={ref} className="relative">
        {active !== null && (
          <ChartTooltip
            x={left + active * slot + slot / 2}
            containerWidth={width}
            title={labels[active]}
            rows={[{ label: seriesLabel, value: format(values[active]), color: barColor(values[active]) }]}
          />
        )}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="block max-w-full"
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
              <text x={left - 8} y={yAt(tick) + 4} textAnchor="end" fontSize="11" fill="var(--chart-ink)">
                {compactNumber(tick)}
              </text>
            </g>
          ))}
          <line x1={left} x2={width - right} y1={zeroY} y2={zeroY} stroke="var(--chart-axis)" strokeWidth="1.5" />

          <g className="chart-marks">
            {values.map((value, index) => {
              const x = left + index * slot + (slot - barWidth) / 2;
              const y = Math.min(zeroY, yAt(value));
              const h = Math.max(2, Math.abs(zeroY - yAt(value)));
              const isActive = index === active;
              return (
                <g
                  key={labels[index] + index}
                  className={`chart-mark ${isActive ? "is-active" : ""}`}
                  onPointerEnter={() => setActive(index)}
                  onPointerDown={() => setActive(index)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Generous hit area: the whole column slot */}
                  <rect x={left + index * slot} y={top} width={slot} height={plotHeight} fill="transparent" />
                  <rect x={x} y={y} width={barWidth} height={h} rx="4" fill={barColor(value)} />
                </g>
              );
            })}
          </g>

          {labels.map((label, index) =>
            index % stride === (labels.length - 1) % stride ? (
              <text
                key={label + index}
                x={left + index * slot + slot / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fontWeight={index === active ? 700 : 400}
                fill="var(--chart-ink)"
              >
                {label}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <div className="mt-3">
        <Legend
          items={
            signed
              ? [
                  { label: "Profit", color: "var(--chart-positive)" },
                  { label: "Loss", color: "var(--chart-negative)" },
                ]
              : [{ label: seriesLabel, color }]
          }
        />
      </div>
    </div>
  );
});
