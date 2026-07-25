import type { Entry, ReportScope } from "@/types";
import { MONTH_NAMES, monthEndLabel, quarterMonths } from "@/lib/categories";
import { filterByMonths } from "@/lib/calculations";

function parseDay(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y: y || 0, m: m || 1, d: d || 1 };
}

/** "July 9, 2026" */
export function dayLabel(date: string): string {
  const { y, m, d } = parseDay(date);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

export function scopeEntries(entries: Entry[], scope: ReportScope): Entry[] {
  if (scope.kind === "day") return entries.filter((e) => e.date === scope.date);
  if (scope.kind === "month") return filterByMonths(entries, [scope.month]);
  if (scope.kind === "quarter") return filterByMonths(entries, quarterMonths(scope.quarter));
  return entries;
}

export function scopePeriodLabel(scope: ReportScope): string {
  if (scope.kind === "day") return `For the Day ${dayLabel(scope.date)}`;
  if (scope.kind === "month")
    return `For the Month Ended ${monthEndLabel(scope.year, scope.month)}`;
  if (scope.kind === "quarter") {
    const months = quarterMonths(scope.quarter);
    const last = months[2];
    return `For the Quarter Ended ${monthEndLabel(scope.year, last)}`;
  }
  return `For the Year Ended December 31, ${scope.year}`;
}

export function scopeFilename(scope: ReportScope, ext: "pdf" | "xlsx"): string {
  if (scope.kind === "day") {
    const { y, m, d } = parseDay(scope.date);
    return `ExpenseStatement_${MONTH_NAMES[m - 1]}_${d}_${y}.${ext}`;
  }
  if (scope.kind === "month")
    return `ExpenseStatement_${MONTH_NAMES[scope.month - 1]}_${scope.year}.${ext}`;
  if (scope.kind === "quarter")
    return `ExpenseStatement_Q${scope.quarter}_${scope.year}.${ext}`;
  return ext === "pdf"
    ? `ExpenseStatement_${scope.year}_Annual.${ext}`
    : `ExpenseStatement_Annual_${scope.year}.${ext}`;
}

export function scopeSheetName(scope: ReportScope): string {
  if (scope.kind === "day") {
    const { y, m, d } = parseDay(scope.date);
    return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
  }
  if (scope.kind === "month") return `${MONTH_NAMES[scope.month - 1]} ${scope.year}`;
  if (scope.kind === "quarter") return `Q${scope.quarter} ${scope.year}`;
  return `FY ${scope.year}`;
}

export function scopeTitle(scope: ReportScope): string {
  if (scope.kind === "day") return dayLabel(scope.date);
  if (scope.kind === "month")
    return `${MONTH_NAMES[scope.month - 1]} ${scope.year}`;
  if (scope.kind === "quarter") return `Q${scope.quarter} ${scope.year}`;
  return `${scope.year} (Entire Year)`;
}
