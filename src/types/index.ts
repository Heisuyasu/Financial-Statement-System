export type Section = "income" | "cos" | "opex";

export type PaymentMode = "Petty Cash" | "Check" | "Account";

export interface Entry {
  id: number;
  section: Section;
  date: string; // YYYY-MM-DD
  year: number;
  month: number; // 1-12
  category: string;
  description: string;
  /** Net (VAT-exclusive) amount that flows into the statement. */
  amount: number;
  /** 12% VAT extracted from the VAT-inclusive total (total/1.12*0.12). */
  vat: number;
  /** Which account this transaction belongs to (managed in Settings). */
  account: string;
  /** How it was paid: Petty Cash, Check, or Account. */
  paymentMode: string;
  /** Supplier / payee for this transaction. */
  supplier: string;
  /** Receipt math, e.g. "1500+2300+800" — kept so editing re-opens the sum. */
  breakdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntryInput {
  id?: number;
  section: Section;
  date: string;
  year: number;
  month: number;
  category: string;
  description: string;
  amount: number;
  vat?: number;
  account?: string;
  paymentMode?: string;
  supplier?: string;
  breakdown?: string;
}

export interface Company {
  id: number;
  name: string;
  logo: string; // data URL
  address: string;
  tin: string;
  currency: string;
  fiscalYearStart: number;
  decimalPlaces: number;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  entity: string;
  entityId: number | null;
  details: string;
  createdAt: string;
}

export interface CategoryLine {
  category: string;
  amount: number;
  percent: number;
}

export interface StatementData {
  cosLines: CategoryLine[];
  opexLines: CategoryLine[];
  totalCos: number;
  totalOpex: number;
  totalExpenses: number;
}

export interface MonthlyTotals {
  month: number;
  totalCos: number;
  totalOpex: number;
  totalExpenses: number;
}

export type ReportScope =
  | { kind: "day"; date: string } // YYYY-MM-DD
  | { kind: "month"; year: number; month: number }
  | { kind: "quarter"; year: number; quarter: 1 | 2 | 3 | 4 }
  | { kind: "year"; year: number };

export type PageId =
  | "dashboard"
  | "entries"
  | "statement"
  | "annual"
  | "customers"
  | "exports"
  | "settings";
