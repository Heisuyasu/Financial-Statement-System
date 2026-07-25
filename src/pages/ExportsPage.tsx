import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useReportActions } from "@/hooks/useReportActions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MONTH_NAMES } from "@/lib/categories";
import { scopeFilename, dayLabel } from "@/lib/export/report-scope";
import { DatePicker } from "@/components/ui/date-picker";
import type { ReportScope } from "@/types";

export function ExportsPage() {
  const { date, setDate, year, month } = useAppStore();
  const { exportPdf, exportXlsx } = useReportActions();
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.ceil(month / 3) as 1 | 2 | 3 | 4) || 1
  );
  const [busy, setBusy] = useState(false);

  const run = async (fn: (s: ReportScope) => Promise<void>, scope: ReportScope) => {
    setBusy(true);
    try {
      await fn(scope);
    } finally {
      setBusy(false);
    }
  };

  const dayScope: ReportScope = { kind: "day", date };
  const monthScope: ReportScope = { kind: "month", year, month };
  const quarterScope: ReportScope = { kind: "quarter", year, quarter };
  const yearScope: ReportScope = { kind: "year", year };

  const blocks: {
    title: string;
    description: string;
    scope: ReportScope;
    extra?: React.ReactNode;
  }[] = [
    {
      title: `Certain Day — ${dayLabel(date)}`,
      description: "Expense statement and transaction details for a single day's receipts.",
      scope: dayScope,
      extra: (
        <div className="space-y-1">
          <Label>Day</Label>
          <DatePicker className="w-48" value={date} onChange={setDate} />
        </div>
      ),
    },
    {
      title: `Current Month — ${MONTH_NAMES[month - 1]} ${year}`,
      description: "Income statement, transaction details and expense breakdown for the selected month.",
      scope: monthScope,
    },
    {
      title: `Quarter — Q${quarter} ${year}`,
      description: "Combined income statement for the three months of the selected quarter.",
      scope: quarterScope,
      extra: (
        <div className="space-y-1">
          <Label>Quarter</Label>
          <Select
            className="w-40"
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
          >
            <option value={1}>Q1 (Jan–Mar)</option>
            <option value={2}>Q2 (Apr–Jun)</option>
            <option value={3}>Q3 (Jul–Sep)</option>
            <option value={4}>Q4 (Oct–Dec)</option>
          </Select>
        </div>
      ),
    },
    {
      title: `Entire Year — ${year}`,
      description: "Annual income statement, monthly summary worksheet, transactions and expense breakdown.",
      scope: yearScope,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Exports</h1>
        <p className="text-sm text-muted-foreground">
          Generate professionally formatted PDF and Excel reports. You choose where each file is saved.
        </p>
      </div>

      {blocks.map((b) => (
        <Card key={b.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{b.title}</CardTitle>
            <CardDescription>{b.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            {b.extra}
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(exportPdf, b.scope)}
              >
                <FileDown />
                PDF — {scopeFilename(b.scope, "pdf")}
              </Button>
              <Button disabled={busy} onClick={() => run(exportXlsx, b.scope)}>
                <FileSpreadsheet />
                Excel — {scopeFilename(b.scope, "xlsx")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
