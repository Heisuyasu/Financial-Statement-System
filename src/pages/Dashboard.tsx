import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Truck, Building, Banknote, TrendingUp, PiggyBank, Pencil } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore, selectMonthEntries } from "@/store/useEntriesStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { buildStatement, buildMonthlyTotals } from "@/lib/calculations";
import { MONTH_NAMES, SECTION_LABELS } from "@/lib/categories";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { dayLabel } from "@/lib/export/report-scope";
import { cn } from "@/lib/utils";

const PIE_COLORS_LIGHT = [
  "#021A54", "#FF85BB", "#33509B", "#FFCEE3", "#5F76C2",
  "#E44E93", "#8C9FD9", "#A81F63", "#BCC9F5", "#5F0D36",
];
const PIE_COLORS_DARK = [
  "#8C9FD9", "#FF85BB", "#5F76C2", "#FFCEE3", "#BCC9F5",
  "#E44E93", "#7A8FD0", "#FF5CA8", "#DCE3FA", "#FFB3D4",
];

export function Dashboard() {
  const { date, setDate, year, month, theme } = useAppStore();
  const dark = theme === "dark";
  const pieColors = dark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT;
  const lineColors = {
    direct: dark ? "#8C9FD9" : "#33509B",
    opex: "#FF85BB",
    total: dark ? "#FFCEE3" : "#021A54",
  };
  const { entries } = useEntriesStore();
  const { company } = useCompanyStore();
  const d = company?.decimalPlaces ?? 2;
  const currency = company?.currency ?? "PHP";

  // ----- Scope: the cards + breakdown show a certain day, month, or year -----
  const [dashScope, setDashScope] = useState<"day" | "month" | "year">("month");
  const scopedEntries = useMemo(() => {
    if (dashScope === "day") return entries.filter((e) => e.date === date);
    if (dashScope === "month") return selectMonthEntries(entries, month);
    return entries;
  }, [entries, dashScope, date, month]);
  const statement = useMemo(() => buildStatement(scopedEntries), [scopedEntries]);
  const monthlyTotals = useMemo(() => buildMonthlyTotals(entries), [entries]);

  const periodLabel =
    dashScope === "day"
      ? dayLabel(date)
      : dashScope === "month"
        ? `${MONTH_NAMES[month - 1]} ${year}`
        : `${year}`;

  const trendData = monthlyTotals.map((t) => ({
    name: MONTH_NAMES[t.month - 1].slice(0, 3),
    "Direct Cost": Number(t.totalCos.toFixed(2)),
    "Operating Expenses": Number(t.totalOpex.toFixed(2)),
    "Total Expenses": Number(t.totalExpenses.toFixed(2)),
  }));

  const expenseData = useMemo(() => {
    const all = [...statement.cosLines, ...statement.opexLines]
      .filter((l) => l.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const top = all.slice(0, 9);
    const rest = all.slice(9).reduce((s, l) => s + l.amount, 0);
    const data = top.map((l) => ({ name: l.category, value: Number(l.amount.toFixed(2)) }));
    if (rest > 0) data.push({ name: "Others", value: Number(rest.toFixed(2)) });
    return data;
  }, [statement]);

  const recent = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
        .slice(0, 8),
    [entries]
  );

  // ----- Revenue (typed in by the user, saved per day / month / year) -----
  const revenueKey =
    dashScope === "day"
      ? `revenue:day:${date}`
      : dashScope === "month"
        ? `revenue:${year}-${String(month).padStart(2, "0")}`
        : `revenue:year:${year}`;
  const [revenueText, setRevenueText] = useState("");
  const [editingRevenue, setEditingRevenue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.settings.getAll().then((settings) => {
      if (!cancelled) setRevenueText(settings[revenueKey] ?? "");
    });
    setEditingRevenue(false);
    return () => {
      cancelled = true;
    };
  }, [revenueKey]);

  const revenue = Number(revenueText) || 0;
  const grossProfit = revenue - statement.totalCos;
  const netIncome = grossProfit - statement.totalOpex;

  const saveRevenue = () => {
    api.settings.set(revenueKey, revenueText.trim());
    setEditingRevenue(false);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {MONTH_NAMES[month - 1]} {year} at a glance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#FFCEE3] px-4 py-1.5 text-xs font-semibold text-[#021A54]">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"} this year
          </div>
          {/* Scope: certain day / month / year */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["day", "month", "year"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDashScope(s)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors",
                  dashScope === s
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <DatePicker className="w-48" value={date} onChange={setDate} />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Revenue — typed in by the user, saved for this month */}
        <Card className="border-0 bg-gradient-to-br from-[#021A54] to-[#1B3A85] text-white shadow-lg shadow-[#021A54]/20">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF85BB] text-[#021A54]">
              <Banknote className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-[#FFCEE3]">
                Revenue — {periodLabel} (click to edit)
              </div>
              {editingRevenue ? (
                <input
                  autoFocus
                  value={revenueText}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(e) => {
                    if (/^\d*\.?\d{0,2}$/.test(e.target.value)) setRevenueText(e.target.value);
                  }}
                  onBlur={saveRevenue}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRevenue();
                    if (e.key === "Escape") setEditingRevenue(false);
                  }}
                  className="w-full bg-transparent text-2xl font-bold tabular-nums text-white placeholder:text-white/40 outline-none border-b border-[#FF85BB]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingRevenue(true)}
                  className="group flex items-center gap-2 text-left"
                  title="Click to enter this month's revenue"
                >
                  <span className="truncate text-2xl font-bold tabular-nums">
                    {formatMoney(revenue, d, true, currency)}
                  </span>
                  <Pencil className="h-4 w-4 shrink-0 text-[#FFCEE3] opacity-60 group-hover:opacity-100" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#021A54]/10 text-[#021A54] dark:bg-[#FFCEE3]/10 dark:text-[#FFCEE3]">
              <Truck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-muted-foreground">
                Direct Cost — {periodLabel}
              </div>
              <div className="truncate text-2xl font-bold tabular-nums">
                {formatMoney(statement.totalCos, d, true, currency)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFCEE3] text-[#A81F63]">
              <Building className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-muted-foreground">
                Operating Expenses — {periodLabel}
              </div>
              <div className="truncate text-2xl font-bold tabular-nums">
                {formatMoney(statement.totalOpex, d, true, currency)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gross Profit = Revenue − Direct Cost */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF85BB]/20 text-[#E44E93]">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-muted-foreground">
                Gross Profit
              </div>
              <div
                className={`truncate text-2xl font-bold tabular-nums ${
                  grossProfit < 0 ? "text-destructive" : ""
                }`}
              >
                {formatMoney(grossProfit, d, true, currency)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Income = Gross Profit − Operating Expenses */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <PiggyBank className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-muted-foreground">
                Net Income
              </div>
              <div
                className={`truncate text-2xl font-bold tabular-nums ${
                  netIncome < 0 ? "text-destructive" : ""
                }`}
              >
                {formatMoney(netIncome, d, true, currency)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Expense Trends — {year}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} width={70} />
                <Tooltip formatter={(v: number) => formatMoney(v, d, true, currency)} />
                <Legend />
                <Line type="monotone" dataKey="Direct Cost" stroke={lineColors.direct} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Operating Expenses" stroke={lineColors.opex} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Total Expenses" stroke={lineColors.total} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Expense Breakdown — {periodLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {expenseData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No expenses recorded for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {expenseData.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v, d, true, currency)} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: 10, maxWidth: 140 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Transactions — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No transactions yet. Start encoding in Financial Entries.
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((e) => (
                <div key={`${e.section}-${e.id}`} className="flex items-center gap-3 py-2">
                  <Badge variant={e.section === "cos" ? "warning" : "secondary"}>
                    {SECTION_LABELS[e.section]}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.category}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {e.description || "—"} · {formatDate(e.date)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatMoney(e.amount, d, true, currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
