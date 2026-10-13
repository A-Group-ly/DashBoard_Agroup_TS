import { toCents } from "../../shared/money";
import type { Currency } from "../../shared/types";

export const COMPANY_TIME_ZONE = "Africa/Tripoli";

export function formatCents(cents: bigint, currency: Currency): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");

  const formatted = `${whole.toLocaleString("en-US")}.${fraction}`;
  const sign = negative ? "−" : "";

  return currency === "LYD" ? `${sign}${formatted} LYD` : `${sign}$${formatted}`;
}

export function money(value: string, currency: Currency): string {
  return formatCents(toCents(value), currency);
}

export function formatChange(value: number | null | undefined): string {
  if (value == null) return "N/A";

  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const sign = normalized > 0 ? "+" : normalized < 0 ? "−" : "";

  return `${sign}${Math.abs(normalized).toFixed(1)}%`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COMPANY_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
