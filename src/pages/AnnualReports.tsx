import { useMemo, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore } from "@/store/useEntriesStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { buildStatement, buildMonthlyTotals } from "@/lib/calculations";
import { useReportActions } from "@/hooks/useReportActions";
import { StatementReport } from "@/components/statement/StatementReport";
import { AnnualSummaryTable } from "@/components/statement/AnnualSummaryTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

export function AnnualReports() {
  const { year } = useAppStore();
  const { entries } = useEntriesStore();
  const { company } = useCompanyStore();
  const { exportPdf, exportXlsx } = useReportActions();
  const d = company?.decimalPlaces ?? 2;
  const currency = company?.currency ?? "PHP";

  const statement = useMemo(() => buildStatement(entries), [entries]);
  const monthly = useMemo(() => buildMonthlyTotals(entries), [entries]);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `ExpenseStatement_${year}_Annual`,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="no-print flex items-center gap-3 border-b bg-card px-4 py-3">
        <div>
          <h1 className="text-lg font-bold">Annual Report — {year}</h1>
          <p className="text-xs text-muted-foreground">
            Combines all monthly records from January through December {year}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer />
            Print Entire Year
          </Button>
          <Button variant="outline" onClick={() => exportPdf({ kind: "year", year })}>
            <FileDown />
            Export PDF
          </Button>
          <Button onClick={() => exportXlsx({ kind: "year", year })}>
            <FileSpreadsheet />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/40 p-4">
        {/* Annual totals */}
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Annual Direct Cost", statement.totalCos],
            ["Annual Operating Expenses", statement.totalOpex],
            ["Annual Total Expenses", statement.totalExpenses],
          ].map(([label, value]) => (
            <Card key={label as string}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-bold tabular-nums">
                  {formatMoney(value as number, d, true, currency)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Month-by-month summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Month-by-Month Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnualSummaryTable totals={monthly} company={company} />
          </CardContent>
        </Card>

        {/* Full annual statement (printable) */}
        <StatementReport
          ref={printRef}
          company={company}
          periodLabel={`For the Year Ended December 31, ${year}`}
          statement={statement}
        />
      </div>
    </div>
  );
}
