import * as React from "react";
import type { StatementData, Company } from "@/types";
import { formatMoney, formatPercent } from "@/lib/format";

interface Props {
  company: Company | null;
  periodLabel: string; // e.g. "For the Month Ended January 31, 2025"
  statement: StatementData;
  showZeroLines?: boolean;
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
}

function Row({
  label,
  amount,
  percent,
  decimals,
  indent = false,
  bold = false,
  topBorder = false,
  doubleBorder = false,
}: {
  label: string;
  amount: number;
  percent: number;
  decimals: number;
  indent?: boolean;
  bold?: boolean;
  topBorder?: boolean;
  doubleBorder?: boolean;
}) {
  return (
    <tr className={bold ? "font-bold" : ""}>
      <td className={`py-0.5 ${indent ? "pl-8" : "pl-2"}`}>{label}</td>
      <td
        className={`py-0.5 pr-2 text-right tabular-nums ${
          topBorder ? "border-t border-black" : ""
        } ${doubleBorder ? "border-b-4 border-double border-black" : ""}`}
      >
        {formatMoney(amount, decimals)}
      </td>
      <td className="w-16 py-0.5 pr-2 text-right tabular-nums text-xs">
        {formatPercent(percent)}
      </td>
    </tr>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={3} className="pl-2 pt-2 font-bold underline">
        {label}
      </td>
    </tr>
  );
}

/**
 * Professional accountant-style Expense Statement.
 * Used for on-screen live preview AND for printing (react-to-print).
 */
export const StatementReport = React.forwardRef<HTMLDivElement, Props>(
  (
    {
      company,
      periodLabel,
      statement,
      showZeroLines = false,
      preparedBy = "",
      checkedBy = "",
      approvedBy = "",
    },
    ref
  ) => {
    const decimals = company?.decimalPlaces ?? 2;
    const currency = company?.currency ?? "PHP";
    // Signatories come from Settings; per-report overrides win if provided
    const signPrepared = preparedBy || company?.preparedBy || "";
    const signChecked = checkedBy || company?.checkedBy || "";
    const signApproved = approvedBy || company?.approvedBy || "";
    const visible = (lines: typeof statement.cosLines) =>
      showZeroLines ? lines : lines.filter((l) => l.amount !== 0);

    const cosLines = visible(statement.cosLines);
    const opexLines = visible(statement.opexLines);

    const pctOfTotal = (amount: number) =>
      statement.totalExpenses !== 0 ? (amount / statement.totalExpenses) * 100 : 0;

    return (
      <div
        ref={ref}
        className="statement-report print-area mx-auto w-full max-w-[210mm] bg-white p-8 text-sm text-black shadow-sm dark:shadow-none"
      >
        {/* Header */}
        <div className="mb-6 text-center">
          {company?.logo && (
            <img
              src={company.logo}
              alt="Company logo"
              className="mx-auto mb-2 h-16 w-16 object-contain"
            />
          )}
          <h1 className="text-xl font-bold uppercase tracking-wide">
            {company?.name ?? "Company Name"}
          </h1>
          {company?.address && <div className="text-xs">{company.address}</div>}
          {company?.tin && <div className="text-xs">TIN: {company.tin}</div>}
          <h2 className="mt-3 text-lg font-bold uppercase tracking-widest">
            Expense Statement
          </h2>
          <div className="italic">{periodLabel}</div>
          <div className="mt-1 text-xs">(Amounts in {currency})</div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-xs font-bold uppercase">
              <th className="pb-1 pl-2 text-left">Account</th>
              <th className="pb-1 pr-2 text-right">Amount</th>
              <th className="w-16 pb-1 pr-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {/* DIRECT COST */}
            <SectionHeader label="DIRECT COST" />
            {cosLines.map((l) => (
              <Row
                key={l.category}
                label={l.category}
                amount={l.amount}
                percent={l.percent}
                decimals={decimals}
                indent
              />
            ))}
            <Row
              label="TOTAL DIRECT COST"
              amount={statement.totalCos}
              percent={pctOfTotal(statement.totalCos)}
              decimals={decimals}
              bold
              topBorder
            />

            {/* OPERATING EXPENSES */}
            <SectionHeader label="OPERATING EXPENSES" />
            {opexLines.map((l) => (
              <Row
                key={l.category}
                label={l.category}
                amount={l.amount}
                percent={l.percent}
                decimals={decimals}
                indent
              />
            ))}
            <Row
              label="TOTAL OPERATING EXPENSES"
              amount={statement.totalOpex}
              percent={pctOfTotal(statement.totalOpex)}
              decimals={decimals}
              bold
              topBorder
            />

            {/* TOTAL EXPENSES */}
            <Row
              label="TOTAL EXPENSES"
              amount={statement.totalExpenses}
              percent={100}
              decimals={decimals}
              bold
              topBorder
              doubleBorder
            />
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-14 grid grid-cols-3 gap-8 text-center text-xs">
          {[
            ["Prepared By", signPrepared],
            ["Checked By", signChecked],
            ["Approved By", signApproved],
          ].map(([label, name]) => (
            <div key={label}>
              <div className="mb-10 font-semibold">{label}:</div>
              <div className="border-t border-black pt-1">{name || " "}</div>
              <div className="text-[10px] text-neutral-500">
                Signature over printed name
              </div>
            </div>
          ))}
        </div>

        {/* Print footer */}
        <div className="mt-8 flex justify-between border-t pt-2 text-[10px] text-neutral-500">
          <span>
            Printed on{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span>Financial Statement Generator</span>
        </div>
      </div>
    );
  }
);
StatementReport.displayName = "StatementReport";
