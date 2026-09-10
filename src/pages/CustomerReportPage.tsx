import { Fragment, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, Trophy, Users } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore } from "@/store/useEntriesStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { buildCustomerReport } from "@/lib/customerReport";
import { scopeEntries, scopePeriodLabel, scopeTitle } from "@/lib/export/report-scope";
import { exportCustomerReportPdf } from "@/lib/export/pdf";
import { exportCustomerReportExcel } from "@/lib/export/excel";
import { formatMoney } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import type { Entry, ReportScope } from "@/types";

const NO_CUSTOMER = "(No customer)";
const customerOf = (e: Entry) => (e.account ?? "").trim() || NO_CUSTOMER;

function isoDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

export function CustomerReportPage() {
  const { year, month, date, setDate, notify } = useAppStore();
  const { entries } = useEntriesStore();
  const { company } = useCompanyStore();

  const [kind, setKind] = useState<"day" | "month" | "quarter" | "year">("month");
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.ceil(month / 3) as 1 | 2 | 3 | 4) || 1
  );
  const [customer, setCustomer] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  const d = company?.decimalPlaces ?? 2;
  const money = (n: number) => formatMoney(n, d);

  const scope: ReportScope = useMemo(
    () =>
      kind === "day"
        ? { kind: "day", date }
        : kind === "month"
          ? { kind: "month", year, month }
          : kind === "quarter"
            ? { kind: "quarter", year, quarter }
            : { kind: "year", year },
    [kind, date, year, month, quarter]
  );

  // Entries within the chosen period (before the customer & category filter).
  const scoped = useMemo(() => scopeEntries(entries, scope), [entries, scope]);

  // Customer dropdown options come from whoever appears in this period.
  const customerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of scoped) set.add(customerOf(e));
    return Array.from(set).sort((a, b) => {
      if (a === NO_CUSTOMER) return 1;
      if (b === NO_CUSTOMER) return -1;
      return a.localeCompare(b);
    });
  }, [scoped]);

  // If the selected customer isn't in this period, fall back to "all".
  const activeCustomer =
    customer !== "all" && !customerOptions.includes(customer) ? "all" : customer;

  // Category dropdown options come from whoever appears in this period (and customer if chosen).
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    const source =
      activeCustomer === "all"
        ? scoped
        : scoped.filter((e) => customerOf(e) === activeCustomer);
    for (const e of source) {
      if (e.category?.trim()) set.add(e.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scoped, activeCustomer]);

  // If the selected category isn't in this period/customer, fall back to "all".
  const activeCategory =
    category !== "all" && !categoryOptions.includes(category) ? "all" : category;

  const report = useMemo(() => {
    let list =
      activeCustomer === "all"
        ? scoped
        : scoped.filter((e) => customerOf(e) === activeCustomer);
    if (activeCategory !== "all") {
      list = list.filter((e) => (e.category ?? "").trim() === activeCategory);
    }
    return buildCustomerReport(list);
  }, [scoped, activeCustomer, activeCategory]);

  const filterSuffix =
    (activeCustomer !== "all" ? ` — ${activeCustomer}` : "") +
    (activeCategory !== "all" ? ` — ${activeCategory}` : "");

  const periodLabel = scopePeriodLabel(scope) + filterSuffix;
  const title = scopeTitle(scope) + filterSuffix;
  const baseName = `CustomerExpenses_${title.replace(/[^\w]+/g, "_")}`;
  const maxTotal = report.groups.reduce((m, g) => Math.max(m, g.total), 0);

  const runPdf = async () => {
    setBusy(true);
    try {
      const saved = await exportCustomerReportPdf(
        company,
        periodLabel,
        report,
        `${baseName}.pdf`
      );
      notify(saved ? `Exported ${baseName}.pdf` : "PDF export cancelled");
    } finally {
      setBusy(false);
    }
  };

  const runXlsx = async () => {
    setBusy(true);
    try {
      const saved = await exportCustomerReportExcel({
        company,
        periodLabel,
        report,
        filename: `${baseName}.xlsx`,
      });
      notify(saved ? `Exported ${baseName}.xlsx` : "Excel export cancelled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header + controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5" />
            Expenses by Customer of Revenue
          </h1>
          <p className="text-xs text-muted-foreground">
            See which customer you spent the most on — {periodLabel.replace(/^For the /, "")}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Period</Label>
            <Select
              className="w-40"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="day">Certain day</option>
              <option value="month">{MONTH_NAMES[month - 1]} {year}</option>
              <option value="quarter">Quarter {year}</option>
              <option value="year">Whole year {year}</option>
            </Select>
          </div>
          {kind === "day" && (
            <div className="space-y-1">
              <Label>Day</Label>
              <DatePicker className="w-44" value={date} onChange={setDate} />
            </div>
          )}
          {kind === "quarter" && (
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
          <div className="space-y-1">
            <Label>Customer</Label>
            <Select
              className="w-44"
              value={activeCustomer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="all">All customers</option>
              {customerOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              className="w-48"
              value={activeCategory}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="outline" disabled={busy || report.groups.length === 0} onClick={runPdf}>
            <FileDown />
            PDF
          </Button>
          <Button disabled={busy || report.groups.length === 0} onClick={runXlsx}>
            <FileSpreadsheet />
            Excel
          </Button>
        </div>
      </div>

      {report.groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {activeCustomer === "all" && activeCategory === "all"
              ? "No entries for this period yet."
              : activeCustomer !== "all" && activeCategory !== "all"
                ? `No "${activeCategory}" entries for ${activeCustomer} in this period.`
                : activeCustomer !== "all"
                  ? `No entries for ${activeCustomer} in this period.`
                  : `No "${activeCategory}" entries in this period.`}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Ranking summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-amber-500" />
                Customer Ranking — highest expense first
              </CardTitle>
              <CardDescription>
                Grand total {money(report.grand.total)} across {report.groups.length} customer
                {report.groups.length === 1 ? "" : "s"} (VAT inclusive).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.groups.map((g, i) => (
                <div key={g.customer} className="flex items-center gap-3">
                  <div className="w-6 text-right text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="w-40 shrink-0 truncate text-sm font-medium">{g.customer}</div>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary/70"
                      style={{ width: `${maxTotal > 0 ? (g.total / maxTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {money(g.total)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Detail table (landscape / wide) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transaction Detail — grouped by customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-left text-white">
                      <th className="whitespace-nowrap px-2 py-1.5 font-medium">Date</th>
                      <th className="px-2 py-1.5 text-right font-medium">DC</th>
                      <th className="px-2 py-1.5 text-right font-medium">OPEX</th>
                      <th className="px-2 py-1.5 font-medium">Acct Name</th>
                      <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                      <th className="px-2 py-1.5 font-medium">Description</th>
                      <th className="px-2 py-1.5 font-medium">Customer</th>
                      <th className="px-2 py-1.5 font-medium">Payment</th>
                      <th className="px-2 py-1.5 font-medium">Supplier</th>
                      <th className="px-2 py-1.5 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.groups.map((g, gi) => (
                      <Fragment key={g.customer}>
                        <tr className="bg-slate-100 dark:bg-slate-800/40">
                          <td colSpan={10} className="px-2 py-1 text-xs font-semibold">
                            {gi + 1}. {g.customer}
                          </td>
                        </tr>
                        {g.rows.map((r, ri) => (
                          <tr key={`${g.customer}-${ri}`} className="border-b last:border-0">
                            <td className="whitespace-nowrap px-2 py-1">{isoDayLabel(r.date)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {r.dc > 0 ? money(r.dc) : ""}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {r.opex > 0 ? money(r.opex) : ""}
                            </td>
                            <td className="px-2 py-1">{r.acctName}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{money(r.amount)}</td>
                            <td className="max-w-[180px] truncate px-2 py-1 text-muted-foreground">
                              {r.description || "—"}
                            </td>
                            <td className="px-2 py-1">{r.customer}</td>
                            <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                              {r.paymentMode || "—"}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-1 text-muted-foreground">
                              {r.supplier || "—"}
                            </td>
                            <td className="px-2 py-1 text-right font-medium tabular-nums">
                              {money(r.total)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b-2 bg-slate-50 font-semibold dark:bg-slate-800/20">
                          <td className="px-2 py-1"></td>
                          <td className="px-2 py-1 text-right tabular-nums">{money(g.dc)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{money(g.opex)}</td>
                          <td className="px-2 py-1">Subtotal — {g.customer}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{money(g.amount)}</td>
                          <td colSpan={4} className="px-2 py-1"></td>
                          <td className="px-2 py-1 text-right tabular-nums">{money(g.total)}</td>
                        </tr>
                      </Fragment>
                    ))}
                    <tr className="bg-slate-200 font-bold dark:bg-slate-700/40">
                      <td className="px-2 py-1.5"></td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(report.grand.dc)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(report.grand.opex)}</td>
                      <td className="px-2 py-1.5">GRAND TOTAL</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(report.grand.amount)}</td>
                      <td colSpan={4} className="px-2 py-1.5"></td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(report.grand.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
