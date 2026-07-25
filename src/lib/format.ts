const SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code + " ";
}

export function formatMoney(
  amount: number,
  decimals = 2,
  withSymbol = false,
  currency = "PHP"
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));
  const sign = amount < 0 ? `(${formatted})` : formatted;
  return withSymbol ? `${currencySymbol(currency)}${sign}` : sign;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Safely evaluates receipt math like "1500+2300+800" (plus/minus only).
 * Returns the total rounded to centavos, or null if the expression is invalid.
 */
export function evalAmountExpression(expr: string): number | null {
  const s = expr.replace(/\s+/g, "");
  if (s === "") return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([+-](\d+\.?\d*|\.\d+))*$/.test(s)) return null;
  let total = 0;
  for (const m of s.matchAll(/([+-]?)(\d+\.?\d*|\.\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * parseFloat(m[2]);
  }
  return Math.round(total * 100) / 100;
}

/** True when the expression is actual math (more than a single number). */
export function isMathExpression(expr: string): boolean {
  return /[+-]/.test(expr.replace(/^\s*[+-]?/, ""));
}

/** Standard VAT rate (12%). */
export const VAT_RATE = 0.12;

/**
 * VAT extracted from a VAT-inclusive total.
 * e.g. 500 / 1.12 * 0.12 = 53.57
 */
export function vatOf(total: number): number {
  return Math.round((total / (1 + VAT_RATE)) * VAT_RATE * 100) / 100;
}

/** Net (VAT-exclusive) portion of a VAT-inclusive total: total - vat. */
export function netOf(total: number): number {
  return Math.round((total - vatOf(total)) * 100) / 100;
}
