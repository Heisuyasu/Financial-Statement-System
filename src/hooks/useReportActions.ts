import { useCallback } from "react";
import type { ReportScope } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore } from "@/store/useEntriesStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { buildStatement, buildMonthlyTotals } from "@/lib/calculations";
import {
  scopeEntries,
  scopePeriodLabel,
  scopeFilename,
  scopeSheetName,
} from "@/lib/export/report-scope";
import { exportStatementPdf, exportAnnualPdf } from "@/lib/export/pdf";
import { exportExcel } from "@/lib/export/excel";

/** Shared PDF / Excel export actions for any report scope. */
export function useReportActions() {
  const notify = useAppStore((s) => s.notify);
  const entries = useEntriesStore((s) => s.entries);
  const company = useCompanyStore((s) => s.company);

  const exportPdf = useCallback(
    async (scope: ReportScope) => {
      const scopedEntries = scopeEntries(entries, scope);
      const statement = buildStatement(scopedEntries);
      const filename = scopeFilename(scope, "pdf");
      let saved: boolean;
      if (scope.kind === "year") {
        saved = await exportAnnualPdf(
          company,
          scope.year,
          statement,
          buildMonthlyTotals(entries),
          filename
        );
      } else {
        saved = await exportStatementPdf(
          company,
          scopePeriodLabel(scope),
          statement,
          filename
        );
      }
      notify(saved ? `Exported ${filename}` : "PDF export cancelled");
    },
    [entries, company, notify]
  );

  const exportXlsx = useCallback(
    async (scope: ReportScope) => {
      const scopedEntries = scopeEntries(entries, scope);
      const statement = buildStatement(scopedEntries);
      const filename = scopeFilename(scope, "xlsx");
      const saved = await exportExcel({
        company,
        periodLabel: scopePeriodLabel(scope),
        sheetName: scopeSheetName(scope),
        statement,
        entries: scopedEntries,
        filename,
        annual:
          scope.kind === "year"
            ? { year: scope.year, monthly: buildMonthlyTotals(entries) }
            : undefined,
      });
      notify(saved ? `Exported ${filename}` : "Excel export cancelled");
    },
    [entries, company, notify]
  );

  return { exportPdf, exportXlsx };
}
