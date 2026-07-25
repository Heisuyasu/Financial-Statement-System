import ExcelJS from "exceljs";
import type { Company, StatementData, Entry, MonthlyTotals } from "@/types";
import type { CustomerReport } from "@/lib/customerReport";
import { MONTH_NAMES, SECTION_LABELS } from "@/lib/categories";
import { api } from "@/lib/api";

const THIN = { style: "thin" as const, color: { argb: "FF9CA3AF" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E293B" },
};

function accountingFormat(decimals: number, symbol: string): string {
  const zeros = decimals > 0 ? "." + "0".repeat(decimals) : "";
  return `_("${symbol}"* #,##0${zeros}_);_("${symbol}"* (#,##0${zeros});_("${symbol}"* "-"${zeros ? "??" : ""}_);_(@_)`;
}

function styleTitle(ws: ExcelJS.Worksheet, row: number, text: string, size = 14) {
  ws.mergeCells(row, 1, row, 4);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, size, name: "Calibri" };
  cell.alignment = { horizontal: "center" };
}

function addStatementSheet(
  wb: ExcelJS.Workbook,
  company: Company | null,
  periodLabel: string,
  s: StatementData,
  sheetName: string
) {
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  const d = company?.decimalPlaces ?? 2;
  const symbol = company?.currency === "PHP" ? "₱" : company?.currency ?? "";
  const fmt = accountingFormat(d, symbol);

  styleTitle(ws, 1, (company?.name ?? "Company Name").toUpperCase(), 16);
  if (company?.address) styleTitle(ws, 2, company.address, 9);
  styleTitle(ws, 3, "EXPENSE STATEMENT", 13);
  styleTitle(ws, 4, periodLabel, 10);
  ws.getCell(4, 1).font = { italic: true, size: 10 };

  let r = 6;
  const head = ws.getRow(r);
  head.values = ["Account", "", "Amount", "%"];
  ws.mergeCells(r, 1, r, 2);
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.border = BORDER;
    c.alignment = { horizontal: "center" };
  });
  r++;

  const pct = (a: number) => (s.totalExpenses !== 0 ? a / s.totalExpenses : 0);

  const sectionRow = (label: string) => {
    ws.mergeCells(r, 1, r, 4);
    const c = ws.getCell(r, 1);
    c.value = label;
    c.font = { bold: true, underline: true };
    r++;
  };

  const lineRow = (
    label: string,
    amount: number,
    percent: number,
    opts?: { bold?: boolean; indent?: boolean; topBorder?: boolean; double?: boolean }
  ) => {
    ws.mergeCells(r, 1, r, 2);
    const lbl = ws.getCell(r, 1);
    lbl.value = label;
    lbl.alignment = { indent: opts?.indent ? 2 : 0 };
    if (opts?.bold) lbl.font = { bold: true };

    const amt = ws.getCell(r, 3);
    amt.value = amount;
    amt.numFmt = fmt;
    if (opts?.bold) amt.font = { bold: true };
    if (opts?.topBorder) amt.border = { top: { style: "thin", color: { argb: "FF000000" } } };
    if (opts?.double)
      amt.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "double", color: { argb: "FF000000" } },
      };

    const p = ws.getCell(r, 4);
    p.value = percent;
    p.numFmt = "0.0%";
    if (opts?.bold) p.font = { bold: true };
    r++;
  };

  sectionRow("DIRECT COST");
  for (const l of s.cosLines) {
    lineRow(l.category, l.amount, l.percent / 100, { indent: true });
  }
  lineRow("TOTAL DIRECT COST", s.totalCos, pct(s.totalCos), { bold: true, topBorder: true });

  sectionRow("OPERATING EXPENSES");
  for (const l of s.opexLines) {
    lineRow(l.category, l.amount, l.percent / 100, { indent: true });
  }
  lineRow("TOTAL OPERATING EXPENSES", s.totalOpex, pct(s.totalOpex), {
    bold: true,
    topBorder: true,
  });

  lineRow("TOTAL EXPENSES", s.totalExpenses, 1, { bold: true, double: true });

  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 10;
  return ws;
}

function addTransactionsSheet(wb: ExcelJS.Workbook, company: Company | null, entries: Entry[]) {
  const ws = wb.addWorksheet("Transaction Details");
  const d = company?.decimalPlaces ?? 2;
  const symbol = company?.currency === "PHP" ? "₱" : company?.currency ?? "";

  ws.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Year", key: "year", width: 8 },
    { header: "Month", key: "month", width: 12 },
    { header: "Section", key: "section", width: 20 },
    { header: "Category", key: "category", width: 32 },
    { header: "Description", key: "description", width: 42 },
    { header: "Amount", key: "amount", width: 18 },
  ];
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.border = BORDER;
  });

  for (const e of entries) {
    const row = ws.addRow({
      date: e.date,
      year: e.year,
      month: MONTH_NAMES[e.month - 1],
      section: SECTION_LABELS[e.section],
      category: e.category,
      description: e.description,
      // VAT-inclusive total, as typed — no VAT breakout on statement exports
      amount: Math.round((e.amount + (e.vat ?? 0)) * 100) / 100,
    });
    row.getCell("amount").numFmt = accountingFormat(d, symbol);
    row.eachCell((c) => (c.border = BORDER));
  }
  ws.autoFilter = { from: "A1", to: "G1" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function addExpenseBreakdownSheet(
  wb: ExcelJS.Workbook,
  company: Company | null,
  s: StatementData
) {
  const ws = wb.addWorksheet("Expense Breakdown");
  const d = company?.decimalPlaces ?? 2;
  const symbol = company?.currency === "PHP" ? "₱" : company?.currency ?? "";
  const fmt = accountingFormat(d, symbol);

  ws.columns = [
    { header: "Type", key: "type", width: 22 },
    { header: "Category", key: "category", width: 34 },
    { header: "Amount", key: "amount", width: 18 },
    { header: "% of Total Expenses", key: "pct", width: 18 },
  ];
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.border = BORDER;
  });

  const all = [
    ...s.cosLines.map((l) => ({ type: "Direct Cost", ...l })),
    ...s.opexLines.map((l) => ({ type: "Operating Expenses", ...l })),
  ];
  all.sort((a, b) => b.amount - a.amount);

  for (const l of all) {
    const row = ws.addRow({
      type: l.type,
      category: l.category,
      amount: l.amount,
      pct: l.percent / 100,
    });
    row.getCell("amount").numFmt = fmt;
    row.getCell("pct").numFmt = "0.0%";
    row.eachCell((c) => (c.border = BORDER));
  }

  const totalRow = ws.addRow({
    type: "TOTAL EXPENSES",
    category: "",
    amount: s.totalExpenses,
    pct: 1,
  });
  totalRow.font = { bold: true };
  totalRow.getCell("amount").numFmt = fmt;
  totalRow.getCell("pct").numFmt = "0.0%";
}

function addAnnualSummarySheet(
  wb: ExcelJS.Workbook,
  company: Company | null,
  year: number,
  monthly: MonthlyTotals[]
) {
  const ws = wb.addWorksheet("Annual Summary");
  const d = company?.decimalPlaces ?? 2;
  const symbol = company?.currency === "PHP" ? "₱" : company?.currency ?? "";
  const fmt = accountingFormat(d, symbol);

  ws.mergeCells(1, 1, 1, 4);
  const title = ws.getCell(1, 1);
  title.value = `ANNUAL SUMMARY — ${year}`;
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: "center" };

  const headers = ["Month", "Direct Cost", "Operating Expenses", "Total Expenses"];
  const headRow = ws.getRow(3);
  headRow.values = headers;
  headRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.border = BORDER;
    c.alignment = { horizontal: "center" };
  });

  let r = 4;
  for (const t of monthly) {
    const row = ws.getRow(r);
    row.values = [MONTH_NAMES[t.month - 1], t.totalCos, t.totalOpex, t.totalExpenses];
    for (let c = 2; c <= 4; c++) {
      row.getCell(c).numFmt = fmt;
      row.getCell(c).border = BORDER;
    }
    row.getCell(1).border = BORDER;
    r++;
  }

  const sum = (k: keyof Omit<MonthlyTotals, "month">) =>
    monthly.reduce((acc, t) => acc + t[k], 0);
  const totalRow = ws.getRow(r);
  totalRow.values = [
    "ANNUAL TOTAL",
    sum("totalCos"),
    sum("totalOpex"),
    sum("totalExpenses"),
  ];
  totalRow.font = { bold: true };
  for (let c = 1; c <= 4; c++) {
    totalRow.getCell(c).border = BORDER;
    if (c >= 2) totalRow.getCell(c).numFmt = fmt;
  }

  ws.getColumn(1).width = 16;
  for (let c = 2; c <= 4; c++) ws.getColumn(c).width = 20;
}

function isoDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/**
 * Landscape "Expenses by Customer of Revenue" workbook — grouped, ranked, with
 * per-customer subtotals and a grand total, plus a ranking summary sheet.
 */
export async function exportCustomerReportExcel(options: {
  company: Company | null;
  periodLabel: string;
  report: CustomerReport;
  filename: string;
}): Promise<boolean> {
  const { company, periodLabel, report, filename } = options;
  const d = company?.decimalPlaces ?? 2;
  const symbol = company?.currency === "PHP" ? "₱" : company?.currency ?? "";
  const fmt = accountingFormat(d, symbol);

  const wb = new ExcelJS.Workbook();
  wb.creator = company?.name ?? "Financial Statement Generator";
  wb.created = new Date();

  const COLS = 10;
  const ws = wb.addWorksheet("Expenses by Customer", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  const titleRow = (row: number, text: string, size: number, italic = false) => {
    ws.mergeCells(row, 1, row, COLS);
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { bold: !italic, italic, size, name: "Calibri" };
    c.alignment = { horizontal: "center" };
  };
  titleRow(1, (company?.name ?? "Company Name").toUpperCase(), 15);
  titleRow(2, "EXPENSES BY CUSTOMER OF REVENUE", 12);
  titleRow(3, periodLabel, 10, true);

  const headers = [
    "Date",
    "DC",
    "OPEX",
    "Acct Name",
    "Amount",
    "Description",
    "Customer",
    "Payment",
    "Supplier",
    "Total",
  ];
  let r = 5;
  const head = ws.getRow(r);
  head.values = headers;
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.border = BORDER;
    c.alignment = { horizontal: "center" };
  });
  r++;

  const moneyCells = [2, 3, 5, 10]; // DC, OPEX, Amount, Total

  report.groups.forEach((g, gi) => {
    // Group header
    ws.mergeCells(r, 1, r, COLS);
    const gh = ws.getCell(r, 1);
    gh.value = `${gi + 1}.  ${g.customer}`;
    gh.font = { bold: true };
    gh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    gh.border = BORDER;
    r++;

    for (const row of g.rows) {
      const cur = ws.getRow(r);
      cur.values = [
        isoDayLabel(row.date),
        row.dc || null,
        row.opex || null,
        row.acctName,
        row.amount,
        row.description,
        row.customer,
        row.paymentMode,
        row.supplier,
        row.total,
      ];
      for (const c of moneyCells) cur.getCell(c).numFmt = fmt;
      cur.eachCell((c) => (c.border = BORDER));
      r++;
    }

    // Subtotal
    const sub = ws.getRow(r);
    sub.values = ["", g.dc, g.opex, `Subtotal — ${g.customer}`, g.amount, "", "", "", "", g.total];
    sub.font = { bold: true };
    for (const c of moneyCells) sub.getCell(c).numFmt = fmt;
    sub.eachCell((c) => {
      c.border = BORDER;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    });
    r++;
  });

  // Grand total
  const grand = ws.getRow(r);
  grand.values = [
    "",
    report.grand.dc,
    report.grand.opex,
    "GRAND TOTAL",
    report.grand.amount,
    "",
    "",
    "",
    "",
    report.grand.total,
  ];
  grand.font = { bold: true, size: 11 };
  for (const c of moneyCells) grand.getCell(c).numFmt = fmt;
  grand.eachCell((c) => {
    c.border = BORDER;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCBD5E1" } };
  });

  const widths = [16, 14, 14, 26, 15, 34, 16, 14, 22, 16];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: "frozen", ySplit: 5 }];

  // Ranking summary sheet
  const rank = wb.addWorksheet("Customer Ranking", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  rank.mergeCells(1, 1, 1, 5);
  const rt = rank.getCell(1, 1);
  rt.value = "CUSTOMERS RANKED BY TOTAL EXPENSE";
  rt.font = { bold: true, size: 13 };
  rt.alignment = { horizontal: "center" };
  const rankHead = rank.getRow(3);
  rankHead.values = ["Rank", "Customer", "Direct Cost", "Operating Exp.", "Total"];
  rankHead.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.border = BORDER;
    c.alignment = { horizontal: "center" };
  });
  let rr = 4;
  report.groups.forEach((g, i) => {
    const row = rank.getRow(rr);
    row.values = [i + 1, g.customer, g.dc, g.opex, g.total];
    for (const c of [3, 4, 5]) row.getCell(c).numFmt = fmt;
    row.eachCell((c) => (c.border = BORDER));
    rr++;
  });
  const rankTotal = rank.getRow(rr);
  rankTotal.values = ["", "GRAND TOTAL", report.grand.dc, report.grand.opex, report.grand.total];
  rankTotal.font = { bold: true };
  for (const c of [3, 4, 5]) rankTotal.getCell(c).numFmt = fmt;
  rankTotal.eachCell((c) => (c.border = BORDER));
  rank.getColumn(1).width = 8;
  rank.getColumn(2).width = 28;
  for (const c of [3, 4, 5]) rank.getColumn(c).width = 18;

  const buffer = await wb.xlsx.writeBuffer();
  const result = await api.file.save(
    { defaultName: filename, filterName: "Excel Workbook", extensions: ["xlsx"] },
    buffer as ArrayBuffer
  );
  return result.saved;
}

export async function exportExcel(options: {
  company: Company | null;
  periodLabel: string;
  sheetName: string;
  statement: StatementData;
  entries: Entry[];
  filename: string;
  annual?: { year: number; monthly: MonthlyTotals[] };
}): Promise<boolean> {
  const { company, periodLabel, sheetName, statement, entries, filename, annual } = options;
  const wb = new ExcelJS.Workbook();
  wb.creator = company?.name ?? "Financial Statement Generator";
  wb.created = new Date();

  addStatementSheet(wb, company, periodLabel, statement, sheetName);
  addTransactionsSheet(wb, company, entries);
  addExpenseBreakdownSheet(wb, company, statement);
  if (annual) addAnnualSummarySheet(wb, company, annual.year, annual.monthly);

  const buffer = await wb.xlsx.writeBuffer();
  const result = await api.file.save(
    { defaultName: filename, filterName: "Excel Workbook", extensions: ["xlsx"] },
    buffer as ArrayBuffer
  );
  return result.saved;
}
