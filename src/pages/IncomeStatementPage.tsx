import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, FileDown, FileSpreadsheet, CalendarRange } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore } from "@/store/useEntriesStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { buildStatement } from "@/lib/calculations";
import { scopeEntries, scopePeriodLabel, scopeTitle } from "@/lib/export/report-scope";
import { useReportActions } from "@/hooks/useReportActions";
import { StatementReport } from "@/components/statement/StatementReport";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import type { ReportScope } from "@/types";

export function IncomeStatementPage() {
  const { date, setDate, year, month, setPage } = useAppStore();
  const { entries } = useEntriesStore();
  const { company } = useCompanyStore();
  const { exportPdf, exportXlsx } = useReportActions();

  const [scopeKind, setScopeKind] = useState<"day" | "month" | "quarter" | "year">("month");
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.ceil(month / 3) as 1 | 2 | 3 | 4) || 1
  );
  const [showZeroLines, setShowZeroLines] = useState(false);

  const scope: ReportScope = useMemo(() => {
    if (scopeKind === "day") return { kind: "day", date };
    if (scopeKind === "month") return { kind: "month", year, month };
    if (scopeKind === "quarter") return { kind: "quarter", year, quarter };
    return { kind: "year", year };
  }, [scopeKind, date, year, month, quarter]);

  const scoped = useMemo(() => scopeEntries(entries, scope), [entries, scope]);
  const statement = useMemo(() => buildStatement(scoped), [scoped]);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `ExpenseStatement_${scopeTitle(scope).replace(/[\s()]/g, "_")}`,
  });

  // Ctrl+P from anywhere routes here and fires this event
  useEffect(() => {
    const listener = () => handlePrint();
    window.addEventListener("app:print", listener);
    return () => window.removeEventListener("app:print", listener);
  }, [handlePrint]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-end gap-3 border-b bg-card px-4 py-3">
        <div className="space-y-1">
          <Label>Report scope</Label>
          <Select
            className="w-44"
            value={scopeKind}
            onChange={(e) => setScopeKind(e.target.value as typeof scopeKind)}
          >
            <option value="day">Certain Day</option>
            <option value="month">Current Month</option>
            <option value="quarter">Selected Quarter</option>
            <option value="year">Entire Year</option>
          </Select>
        </div>

        {scopeKind === "day" && (
          <div className="space-y-1">
            <Label>Day</Label>
            <DatePicker className="w-48" value={date} onChange={setDate} />
          </div>
        )}

        {scopeKind === "quarter" && (
          <div className="space-y-1">
            <Label>Quarter</Label>
            <Select
              className="w-36"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            >
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </Select>
          </div>
        )}

        <div className="pb-2 text-xs text-muted-foreground">
          Signatories (Prepared/Checked/Approved by) are set once in{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => setPage("settings")}
          >
            Settings
          </button>
          .
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={showZeroLines}
            onChange={(e) => setShowZeroLines(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Show zero lines
        </label>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setPage("annual")}>
            <CalendarRange />
            View Entire Year
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer />
            Print
          </Button>
          <Button variant="outline" onClick={() => exportPdf(scope)}>
            <FileDown />
            Export PDF
          </Button>
          <Button onClick={() => exportXlsx(scope)}>
            <FileSpreadsheet />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Report */}
      <div className="flex-1 overflow-y-auto bg-muted/40 p-6">
        <StatementReport
          ref={printRef}
          company={company}
          periodLabel={scopePeriodLabel(scope)}
          statement={statement}
          showZeroLines={showZeroLines}
        />
      </div>
    </div>
  );
}
