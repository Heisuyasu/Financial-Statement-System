import type { Entry } from "@/types";

/** One transaction line in the customer expense report. */
export interface CustomerReportRow {
  date: string; // YYYY-MM-DD
  dc: number; // net amount when the entry is a Direct Cost, else 0
  opex: number; // net amount when the entry is an Operating Expense, else 0
  acctName: string; // category, e.g. "Fuel for Vehicles" / "Fuel and Lubricants"
  amount: number; // net (VAT-exclusive) amount
  description: string;
  customer: string; // Customer of Revenue
  paymentMode: string;
  supplier: string;
  total: number; // VAT-inclusive total (net + VAT)
}

export interface CustomerReportGroup {
  customer: string;
  rows: CustomerReportRow[];
  dc: number;
  opex: number;
  amount: number;
  total: number;
}

export interface CustomerReportTotals {
  dc: number;
  opex: number;
  amount: number;
  total: number;
}

export interface CustomerReport {
  /** Groups sorted by total expense, highest first (the ranking). */
  groups: CustomerReportGroup[];
  grand: CustomerReportTotals;
}

const NO_CUSTOMER = "(No customer)";
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Joins distinct non-empty values, e.g. two payment modes, without duplicates. */
function mergeText(a: string, b: string, separator = "; "): string {
  const parts = [a, b].map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(parts)).join(separator);
}

/**
 * Groups entries by Customer of Revenue and ranks them by total expense so it's
 * easy to see which customer cost the most.
 * Entries with the same customer + date + Acct Name are merged into ONE row
 * (amounts summed) so the same account never appears twice for the same day.
 */
export function buildCustomerReport(entries: Entry[]): CustomerReport {
  const map = new Map<string, Map<string, CustomerReportRow>>();

  for (const e of entries) {
    const customer = (e.account ?? "").trim() || NO_CUSTOMER;
    const net = e.amount;
    const vat = e.vat ?? 0;

    let rows = map.get(customer);
    if (!rows) {
      rows = new Map();
      map.set(customer, rows);
    }

    const key = `${e.date}|${e.category}`;
    const existing = rows.get(key);
    if (existing) {
      // Same customer + same date + same Acct Name → sum into one line
      existing.dc = round2(existing.dc + (e.section === "cos" ? net : 0));
      existing.opex = round2(existing.opex + (e.section === "opex" ? net : 0));
      existing.amount = round2(existing.amount + net);
      existing.total = round2(existing.total + net + vat);
      existing.description = mergeText(existing.description, e.description);
      existing.paymentMode = mergeText(existing.paymentMode, e.paymentMode ?? "", ", ");
      existing.supplier = mergeText(existing.supplier, e.supplier ?? "", ", ");
    } else {
      rows.set(key, {
        date: e.date,
        dc: e.section === "cos" ? net : 0,
        opex: e.section === "opex" ? net : 0,
        acctName: e.category,
        amount: net,
        description: e.description,
        customer,
        paymentMode: e.paymentMode ?? "",
        supplier: e.supplier ?? "",
        total: round2(net + vat),
      });
    }
  }

  const groups: CustomerReportGroup[] = [];
  for (const [customer, rowMap] of map) {
    const rows = Array.from(rowMap.values());
    rows.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.acctName.localeCompare(b.acctName)
    );
    groups.push({
      customer,
      rows,
      dc: round2(rows.reduce((s, r) => s + r.dc, 0)),
      opex: round2(rows.reduce((s, r) => s + r.opex, 0)),
      amount: round2(rows.reduce((s, r) => s + r.amount, 0)),
      total: round2(rows.reduce((s, r) => s + r.total, 0)),
    });
  }

  // Ranking: costliest customer first. "(No customer)" always sinks to the bottom.
  groups.sort((a, b) => {
    if (a.customer === NO_CUSTOMER) return 1;
    if (b.customer === NO_CUSTOMER) return -1;
    return b.total - a.total;
  });

  const grand: CustomerReportTotals = {
    dc: round2(groups.reduce((s, g) => s + g.dc, 0)),
    opex: round2(groups.reduce((s, g) => s + g.opex, 0)),
    amount: round2(groups.reduce((s, g) => s + g.amount, 0)),
    total: round2(groups.reduce((s, g) => s + g.total, 0)),
  };

  return { groups, grand };
}
