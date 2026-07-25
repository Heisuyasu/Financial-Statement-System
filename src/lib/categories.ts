import type { Section } from "@/types";

/** Income tracking was removed per client request — the system tracks expenses only. */
export const INCOME_CATEGORIES: readonly string[] = [];

export const COST_OF_SERVICES_CATEGORIES = [
  "Fuel for Vehicles",
  "Travel Expenses/Out of Town",
  "Meal Allowance Driver/Helper",
  "Other Costs",
  "Staffing and Stripping",
  "Salaries and Wages Driver/Helper",
  "Overtime Driver/Helper",
] as const;

export const OPERATING_EXPENSE_CATEGORIES = [
  "Bank Service Charges",
  "Communication and Internet",
  "Depreciation Expense",
  "Insurance Expense",
  "Interest Expense",
  "Food and Subsistence",
  "Supplies Expense",
  "Salary Expense",
  "Miscellaneous Expense",
  "SSS",
  "PhilHealth",
  "Pag-IBIG",
  "Employees Benefits and Welfare",
  "Fuel and Lubricants",
  "Taxes and Licenses",
  "Repairs and Maint-Materials/spar",
  "Repairs and Maint-Labor & Overhead",
  "Repairs and Maint-Tires & Tubes",
  "Membership & Assessment due",
  "Legal and Audit Fee",
  "Donations & Solicitations",
  "Travel and Transportation",
  "Claims",
  "Bad Debt",
  "Light and Water",
  "Representation and Entertainment",
  "Shipping and Courier",
  "Bills and Subscriptions",
  "Rental Office",
  "Rental Shop/Garage",
  "Rental Chassis",
  "Utilities and Maintenance",
] as const;

export const SECTION_LABELS: Record<Section, string> = {
  income: "Income (legacy)",
  cos: "Direct Cost",
  opex: "Operating Expenses",
};

/** Sections available for data entry (income removed per client request). */
export const ENTRY_SECTIONS: Section[] = ["cos", "opex"];

/** Modes of payment available on each entry. */
export const PAYMENT_MODES = ["Petty Cash", "Check", "Account"] as const;

export const CATEGORIES_BY_SECTION: Record<Section, readonly string[]> = {
  income: INCOME_CATEGORIES,
  cos: COST_OF_SERVICES_CATEGORIES,
  opex: OPERATING_EXPENSE_CATEGORIES,
};

export function sectionOfCategory(category: string): Section {
  if ((COST_OF_SERVICES_CATEGORIES as readonly string[]).includes(category)) return "cos";
  return "opex";
}

/** Built-in categories for a section plus any user-added custom ones (deduped). */
export function mergeCategories(section: Section, custom: string[]): string[] {
  const base = CATEGORIES_BY_SECTION[section];
  const seen = new Set(base.map((c) => c.toLowerCase()));
  const extra = custom.filter((c) => c.trim() && !seen.has(c.trim().toLowerCase()));
  return [...base, ...extra];
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** 2023 through next year — grows automatically as time passes. */
export const YEARS: number[] = Array.from(
  { length: new Date().getFullYear() + 1 - 2023 + 1 },
  (_, i) => 2023 + i
);

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthEndLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${lastDayOfMonth(year, month)}, ${year}`;
}

export function quarterMonths(quarter: 1 | 2 | 3 | 4): number[] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}
