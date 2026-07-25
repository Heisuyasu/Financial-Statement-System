import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Company, StatementData, MonthlyTotals } from "@/types";
import type { CustomerReport } from "@/lib/customerReport";
import { formatMoney, formatPercent } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/categories";
import { api } from "@/lib/api";

type Line = [string, string, string];

function statementBody(s: StatementData, d: number): {
  body: Line[];
  boldRows: number[];
  sectionRows: number[];
} {
  const body: Line[] = [];
  const boldRows: number[] = [];
  const sectionRows: number[] = [];
  const pct = (a: number) => (s.totalExpenses !== 0 ? (a / s.totalExpenses) * 100 : 0);
  const push = (l: Line, opts?: { bold?: boolean; section?: boolean }) => {
    body.push(l);
    if (opts?.bold) boldRows.push(body.length - 1);
    if (opts?.section) sectionRows.push(body.length - 1);
  };

  push(["DIRECT COST", "", ""], { section: true });
  for (const l of s.cosLines) {
    push([`    ${l.category}`, formatMoney(l.amount, d), formatPercent(l.percent)]);
  }
  push(
    ["TOTAL DIRECT COST", formatMoney(s.totalCos, d), formatPercent(pct(s.totalCos))],
    { bold: true }
  );

  push(["OPERATING EXPENSES", "", ""], { section: true });
  for (const l of s.opexLines) {
    push([`    ${l.category}`, formatMoney(l.amount, d), formatPercent(l.percent)]);
  }
  push(
    [
      "TOTAL OPERATING EXPENSES",
      formatMoney(s.totalOpex, d),
      formatPercent(pct(s.totalOpex)),
    ],
    { bold: true }
  );

  push(["TOTAL EXPENSES", formatMoney(s.totalExpenses, d), "100.0%"], { bold: true });

  return { body, boldRows, sectionRows };
}

function drawHeader(doc: jsPDF, company: Company | null, periodLabel: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  if (company?.logo) {
    try {
      const match = /^data:image\/(png|jpe?g|webp)/i.exec(company.logo);
      const format = match && match[1].toLowerCase().startsWith("j") ? "JPEG" : match ? match[1].toUpperCase() : "PNG";
      doc.addImage(company.logo, format, pageWidth / 2 - 9, y, 18, 18);
      y += 22;
    } catch {
      /* unsupported image format — skip logo */
    }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text((company?.name ?? "Company Name").toUpperCase(), pageWidth / 2, y, {
    align: "center",
  });
  y += 5.5;

  doc.setFont("times", "normal");
  doc.setFontSize(9);
  if (company?.address) {
    doc.text(company.address, pageWidth / 2, y, { align: "center" });
    y += 4.5;
  }
  if (company?.tin) {
    doc.text(`TIN: ${company.tin}`, pageWidth / 2, y, { align: "center" });
    y += 4.5;
  }

  y += 2;
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("EXPENSE STATEMENT", pageWidth / 2, y, { align: "center" });
  y += 5.5;

  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.text(periodLabel, pageWidth / 2, y, { align: "center" });
  y += 4.5;

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text(`(Amounts in ${company?.currency ?? "PHP"})`, pageWidth / 2, y, {
    align: "center",
  });

  return y + 4;
}

function drawSignaturesAndFooter(
  doc: jsPDF,
  finalY: number,
  company: Company | null
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = finalY + 24;
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 40;
  }

  const cols: [string, string][] = [
    ["Prepared By:", company?.preparedBy ?? ""],
    ["Checked By:", company?.checkedBy ?? ""],
    ["Approved By:", company?.approvedBy ?? ""],
  ];
  const colWidth = (pageWidth - 30) / 3;
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  cols.forEach(([label, name], i) => {
    const x = 15 + i * colWidth;
    doc.text(label, x + colWidth / 2, y, { align: "center" });
    if (name) {
      doc.setFont("times", "normal");
      doc.text(name, x + colWidth / 2, y + 14.5, { align: "center" });
      doc.setFont("times", "bold");
    }
    doc.line(x + 8, y + 16, x + colWidth - 8, y + 16);
    doc.setFont("times", "normal");
    doc.setFontSize(7);
    doc.text("Signature over printed name", x + colWidth / 2, y + 20, {
      align: "center",
    });
    doc.setFont("times", "bold");
    doc.setFontSize(9);
  });

  // Page numbers + print date on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.text(
      `Printed on ${new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      15,
      pageHeight - 8
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, pageHeight - 8, {
      align: "right",
    });
  }
}

function addStatementTable(
  doc: jsPDF,
  startY: number,
  s: StatementData,
  decimals: number
): number {
  const { body, boldRows, sectionRows } = statementBody(s, decimals);
  autoTable(doc, {
    startY,
    head: [["Account", "Amount", "%"]],
    body,
    theme: "plain",
    styles: {
      font: "times",
      fontSize: 9.5,
      cellPadding: { top: 0.8, bottom: 0.8, left: 1.5, right: 1.5 },
      textColor: [0, 0, 0],
    },
    headStyles: {
      fontStyle: "bold",
      lineWidth: { bottom: 0.4 },
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { halign: "right", cellWidth: 45 },
      2: { halign: "right", cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (boldRows.includes(data.row.index)) {
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 1) {
          data.cell.styles.lineWidth = { top: 0.3 };
          data.cell.styles.lineColor = [0, 0, 0];
        }
      }
      if (sectionRows.includes(data.row.index)) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 18, right: 18 },
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** "July 9, 2026" from an ISO date. */
function isoDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/**
 * Landscape "Expenses by Customer of Revenue" report — one row per transaction,
 * grouped and ranked by customer with subtotals and a grand total.
 */
export async function exportCustomerReportPdf(
  company: Company | null,
  periodLabel: string,
  report: CustomerReport,
  filename: string
): Promise<boolean> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const d = company?.decimalPlaces ?? 2;
  const money = (n: number) => formatMoney(n, d);
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  let y = 14;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text((company?.name ?? "Company Name").toUpperCase(), pageWidth / 2, y, {
    align: "center",
  });
  y += 5.5;
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("EXPENSES BY CUSTOMER OF REVENUE", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.setFont("times", "italic");
  doc.setFontSize(9.5);
  doc.text(periodLabel, pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text(`(Amounts in ${company?.currency ?? "PHP"})`, pageWidth / 2, y, {
    align: "center",
  });
  y += 4;

  type Cell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const body: Cell[][] = [];
  const groupHeaderRows: number[] = [];
  const subtotalRows: number[] = [];

  report.groups.forEach((g, gi) => {
    body.push([
      {
        content: `${gi + 1}.  ${g.customer}`,
        colSpan: 10,
        styles: { fontStyle: "bold", fillColor: [226, 232, 240], textColor: [0, 0, 0] },
      },
    ]);
    groupHeaderRows.push(body.length - 1);

    for (const r of g.rows) {
      body.push([
        isoDayLabel(r.date),
        r.dc > 0 ? money(r.dc) : "",
        r.opex > 0 ? money(r.opex) : "",
        r.acctName,
        money(r.amount),
        r.description,
        r.customer,
        r.paymentMode,
        r.supplier,
        money(r.total),
      ]);
    }

    body.push([
      "",
      money(g.dc),
      money(g.opex),
      `Subtotal — ${g.customer}`,
      money(g.amount),
      "",
      "",
      "",
      "",
      money(g.total),
    ]);
    subtotalRows.push(body.length - 1);
  });

  // Grand total
  body.push([
    "",
    money(report.grand.dc),
    money(report.grand.opex),
    "GRAND TOTAL",
    money(report.grand.amount),
    "",
    "",
    "",
    "",
    money(report.grand.total),
  ]);
  const grandRow = body.length - 1;

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
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
      ],
    ],
    body: body as unknown as (string | { content: string })[][],
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 7,
      cellPadding: { top: 1, bottom: 1, left: 1.2, right: 1.2 },
      textColor: [0, 0, 0],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 34 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 40 },
      6: { cellWidth: 22 },
      7: { cellWidth: 20 },
      8: { cellWidth: 26 },
      9: { cellWidth: 23, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (subtotalRows.includes(data.row.index) || data.row.index === grandRow) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor =
          data.row.index === grandRow ? [203, 213, 225] : [241, 245, 249];
      }
    },
    margin: { left: 8, right: 8 },
  });

  // Footer: print date + page numbers
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.text(
      `Printed on ${new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      8,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 8, pageHeight - 6, {
      align: "right",
    });
  }

  return savePdf(doc, filename);
}

async function savePdf(doc: jsPDF, filename: string): Promise<boolean> {
  const buffer = doc.output("arraybuffer");
  const result = await api.file.save(
    { defaultName: filename, filterName: "PDF Document", extensions: ["pdf"] },
    buffer
  );
  return result.saved;
}

/** Month or Quarter statement PDF. */
export async function exportStatementPdf(
  company: Company | null,
  periodLabel: string,
  statement: StatementData,
  filename: string
): Promise<boolean> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const y = drawHeader(doc, company, periodLabel);
  const finalY = addStatementTable(doc, y, statement, company?.decimalPlaces ?? 2);
  drawSignaturesAndFooter(doc, finalY, company);
  return savePdf(doc, filename);
}

/** Annual PDF: full-year statement + month-by-month summary. */
export async function exportAnnualPdf(
  company: Company | null,
  year: number,
  statement: StatementData,
  monthly: MonthlyTotals[],
  filename: string
): Promise<boolean> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const d = company?.decimalPlaces ?? 2;

  const y = drawHeader(doc, company, `For the Year Ended December 31, ${year}`);
  let finalY = addStatementTable(doc, y, statement, d);

  // Monthly summary on a new page
  doc.addPage();
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text(
    `MONTHLY SUMMARY — ${year}`,
    doc.internal.pageSize.getWidth() / 2,
    18,
    { align: "center" }
  );

  const sum = (k: keyof Omit<MonthlyTotals, "month">) =>
    monthly.reduce((acc, t) => acc + t[k], 0);

  autoTable(doc, {
    startY: 24,
    head: [["Month", "Direct Cost", "Operating Expenses", "Total Expenses"]],
    body: [
      ...monthly.map((t) => [
        MONTH_NAMES[t.month - 1],
        formatMoney(t.totalCos, d),
        formatMoney(t.totalOpex, d),
        formatMoney(t.totalExpenses, d),
      ]),
      [
        "ANNUAL TOTAL",
        formatMoney(sum("totalCos"), d),
        formatMoney(sum("totalOpex"), d),
        formatMoney(sum("totalExpenses"), d),
      ],
    ],
    theme: "grid",
    styles: { font: "times", fontSize: 8.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === monthly.length) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 15, right: 15 },
  });

  finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  drawSignaturesAndFooter(doc, finalY, company);
  return savePdf(doc, filename);
}
