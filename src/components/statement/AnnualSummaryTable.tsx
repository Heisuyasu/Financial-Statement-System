import type { MonthlyTotals, Company } from "@/types";
import { MONTH_NAMES } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  totals: MonthlyTotals[];
  company: Company | null;
}

export function AnnualSummaryTable({ totals, company }: Props) {
  const d = company?.decimalPlaces ?? 2;
  const sum = (k: keyof Omit<MonthlyTotals, "month">) =>
    totals.reduce((acc, t) => acc + t[k], 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Direct Cost</TableHead>
          <TableHead className="text-right">Operating Expenses</TableHead>
          <TableHead className="text-right">Total Expenses</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {totals.map((t) => (
          <TableRow key={t.month}>
            <TableCell className="font-medium">{MONTH_NAMES[t.month - 1]}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(t.totalCos, d)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(t.totalOpex, d)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatMoney(t.totalExpenses, d)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="border-t-2 font-bold">
          <TableCell>ANNUAL TOTAL</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(sum("totalCos"), d)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(sum("totalOpex"), d)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(sum("totalExpenses"), d)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
