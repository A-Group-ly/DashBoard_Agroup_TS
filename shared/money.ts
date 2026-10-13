// Exact money arithmetic. Amounts travel as decimal strings ("1250.50")
// and are converted to integer cents (bigint) so totals never pick up
// floating-point errors.

export function toCents(value: { toString(): string } | null | undefined): bigint {
  if (value == null) return 0n;

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.toString().trim());
  if (!match) {
    throw new Error(`Invalid monetary amount: ${String(value)}`);
  }

  const whole = BigInt(match[2]);
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0").slice(0, 2));
  const cents = whole * 100n + fraction;

  return match[1] === "-" ? -cents : cents;
}

/** 123456n -> "1234.56" */
export function centsToDecimal(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

/** Percentage change rounded to one decimal; null when there is no baseline. */
export function percentageChange(
  current: number | bigint,
  previous: number | bigint,
): number | null {
  const currentNumber = Number(current);
  const previousNumber = Number(previous);

  if (previousNumber === 0) {
    return currentNumber === 0 ? 0 : null;
  }

  return (
    Math.round(((currentNumber - previousNumber) / Math.abs(previousNumber)) * 1000) / 10
  );
}
