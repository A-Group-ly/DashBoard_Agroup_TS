import type { ReactNode } from "react";

export function ChartTooltip({
  x,
  containerWidth,
  title,
  rows,
}: {
  x: number;
  containerWidth: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  const width = 190;
  const left = Math.min(Math.max(x - width / 2, 0), Math.max(containerWidth - width, 0));
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs shadow-lg"
      style={{ left, width }}
    >
      <p className="font-semibold text-slate-900">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-slate-600">
              {row.color && <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />}
              {row.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; shape?: "dot" | "line" }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            className={item.shape === "line" ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-sm"}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-200 p-4 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}
