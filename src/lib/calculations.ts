import type { Entry, StatementData, CategoryLine, MonthlyTotals } from "@/types";
import {
  COST_OF_SERVICES_CATEGORIES,
  OPERATING_EXPENSE_CATEGORIES,
} from "@/lib/categories";

function sumByCategory(
  entries: Entry[],
  categories: readonly string[],
  section: Entry["section"]
): CategoryLine[] {
  const map = new Map<string, number>();
  for (const c of categories) map.set(c, 0);
  for (const e of entries) {
    if (e.section !== section) continue;
    // Statement figures are VAT-INCLUSIVE totals (as typed) — no VAT breakout
    const gross = e.amount + (e.vat ?? 0);
    map.set(e.category, (map.get(e.category) ?? 0) + gross);
  }

  // Built-in categories first, in their canonical order...
  const lines = categories.map((category) => ({
    category,
    amount: Math.round((map.get(category) ?? 0) * 100) / 100,
    percent: 0,
  }));

  // ...then any custom categories that actually appear in the entries, so
  // user-added categories still show up on the statement and exports.
  const known = new Set(categories);
  for (const [category, amount] of map) {
    if (!known.has(category)) {
      lines.push({ category, amount: Math.round(amount * 100) / 100, percent: 0 });
    }
  }
  return lines;
}

/**
 * Builds the expense statement from a set of entries.
 * Total Expenses = Total Direct Cost + Total Operating Expenses.
 * Percentages are each amount / Total Expenses x 100.
 */
export function buildStatement(entries: Entry[]): StatementData {
  const cosLines = sumByCategory(entries, COST_OF_SERVICES_CATEGORIES, "cos");
  const opexLines = sumByCategory(entries, OPERATING_EXPENSE_CATEGORIES, "opex");

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalCos = round2(cosLines.reduce((sum, l) => sum + l.amount, 0));
  const totalOpex = round2(opexLines.reduce((sum, l) => sum + l.amount, 0));
  const totalExpenses = round2(totalCos + totalOpex);

  const pct = (amount: number) =>
    totalExpenses !== 0 ? (amount / totalExpenses) * 100 : 0;

  for (const l of cosLines) l.percent = pct(l.amount);
  for (const l of opexLines) l.percent = pct(l.amount);

  return { cosLines, opexLines, totalCos, totalOpex, totalExpenses };
}

export function buildMonthlyTotals(entries: Entry[]): MonthlyTotals[] {
  const totals: MonthlyTotals[] = [];
  for (let month = 1; month <= 12; month++) {
    const monthEntries = entries.filter((e) => e.month === month);
    const s = buildStatement(monthEntries);
    totals.push({
      month,
      totalCos: s.totalCos,
      totalOpex: s.totalOpex,
      totalExpenses: s.totalExpenses,
    });
  }
  return totals;
}

export function filterByMonths(entries: Entry[], months: number[]): Entry[] {
  const set = new Set(months);
  return entries.filter((e) => set.has(e.month));
}
