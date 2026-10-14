import { useEffect, useRef, useState } from "react";

/** Measures a container's width so charts can draw in real pixels. */
export function useChartWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    // ResizeObserver fires once right away; coalesce bursts into one frame.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(Math.max(240, Math.floor(element.clientWidth))));
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return { ref, width };
}

/** Round axis ticks (1, 2, 2.5, 5 × 10ⁿ) covering [min, max]; always includes 0. */
export function niceScale(minValue: number, maxValue: number, targetTicks = 4) {
  const min = Math.min(0, minValue);
  const max = Math.max(0, maxValue);
  const raw = (max - min || 1) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const low = Math.floor(min / step) * step;
  const high = Math.max(Math.ceil(max / step) * step, low + step);
  const ticks: number[] = [];
  for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(Math.round(tick * 100) / 100);
  return { low, high, ticks };
}

export const compactNumber = (value: number) =>
  value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Which labels to draw so they never collide. */
export function labelStride(slotWidth: number, minLabelWidth = 44) {
  return Math.max(1, Math.ceil(minLabelWidth / Math.max(slotWidth, 1)));
}
