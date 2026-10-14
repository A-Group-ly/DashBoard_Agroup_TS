import { memo, useState } from "react";

import { EmptyChart } from "./shared";

export type DonutSlice = { id: string; label: string; value: number; color: string; detail?: string };

/**
 * Pie (donut) chart with a legend that doubles as a data table: every slice
 * is named with its value and share, so colour is never the only cue.
 */
export const DonutChart = memo(function DonutChart({
  title,
  slices,
  format,
  centerLabel,
}: {
  title: string;
  slices: DonutSlice[];
  format: (value: number) => string;
  centerLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const visible = slices.filter((slice) => slice.value > 0);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);

  if (total <= 0) {
    return (
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
        <EmptyChart>Nothing recorded in this range.</EmptyChart>
      </div>
    );
  }

  const size = 180;
  const radius = 72;
  const thickness = 26;
  const center = size / 2;
  const gap = visible.length > 1 ? 0.012 : 0; // small gap between slices, in turns

  let cursor = 0;
  const arcs = visible.map((slice) => {
    const share = slice.value / total;
    const start = cursor + gap / 2;
    const end = cursor + share - gap / 2;
    cursor += share;
    return { ...slice, share, path: arcPath(center, radius, thickness, start, Math.max(start + 0.0001, end)) };
  });

  const focus = arcs.find((arc) => arc.id === active);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${title}: ${arcs.map((arc) => `${arc.label} ${Math.round(arc.share * 100)}%`).join(", ")}`}
          className="shrink-0"
          onPointerLeave={() => setActive(null)}
        >
          {arcs.map((arc) => (
            <path
              key={arc.id}
              d={arc.path}
              fill={arc.color}
              className={`donut-slice ${arc.id === active ? "is-active" : ""}`}
              opacity={active && arc.id !== active ? 0.4 : 1}
              onPointerEnter={() => setActive(arc.id)}
              onPointerDown={() => setActive(arc.id)}
              style={{ cursor: "pointer" }}
            >
              <title>
                {arc.label}: {format(arc.value)} ({(arc.share * 100).toFixed(1)}%)
              </title>
            </path>
          ))}
          <text x={center} y={center - 4} textAnchor="middle" fontSize="11" fill="var(--chart-ink)">
            {focus ? focus.label : centerLabel}
          </text>
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            className="fill-slate-900"
          >
            {focus ? `${(focus.share * 100).toFixed(0)}%` : format(total)}
          </text>
        </svg>

        <ul className="w-full min-w-0 space-y-1 sm:max-w-md">
          {arcs.map((arc) => (
            <li
              key={arc.id}
              onPointerEnter={() => setActive(arc.id)}
              onPointerLeave={() => setActive(null)}
              className={`hover-row flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm ${
                arc.id === active ? "bg-slate-200" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: arc.color }} />
                <span className="truncate">{arc.label}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="font-semibold text-slate-900">{format(arc.value)}</span>
                <span className="ml-2 text-xs text-slate-500">{(arc.share * 100).toFixed(0)}%</span>
                {arc.detail && <span className="block text-xs text-slate-500">{arc.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

function arcPath(c: number, r: number, thickness: number, startTurn: number, endTurn: number): string {
  const inner = r - thickness;
  // A full circle needs two arcs; clamp to just under one turn.
  const end = Math.min(endTurn, startTurn + 0.9999);
  const point = (radius: number, turn: number) => {
    const angle = turn * Math.PI * 2 - Math.PI / 2;
    return [c + radius * Math.cos(angle), c + radius * Math.sin(angle)];
  };
  const large = end - startTurn > 0.5 ? 1 : 0;
  const [x1, y1] = point(r, startTurn);
  const [x2, y2] = point(r, end);
  const [x3, y3] = point(inner, end);
  const [x4, y4] = point(inner, startTurn);
  return [
    `M${x1.toFixed(2)},${y1.toFixed(2)}`,
    `A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
    `L${x3.toFixed(2)},${y3.toFixed(2)}`,
    `A${inner},${inner} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}
