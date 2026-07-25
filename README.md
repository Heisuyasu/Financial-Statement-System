# Financial Statement Generator

A Windows desktop accounting application for encoding daily expenses and generating professional monthly, quarterly and annual **Expense Statements** — built with Electron, React, TypeScript, TailwindCSS, Zustand, TanStack Table and SQLite.

## Features

- **Daily encoding, monthly roll-up** — pick any date with the calendar picker; the statement, dashboard and exports automatically recalculate for that date's month. Switch months/years instantly from the top bar.
- **Grid-style entry** — choose Direct Cost or Operating Expenses and type amounts straight into a table of that section's categories. Arrow keys (↑ ↓ ← →) move between cells, Enter moves down, one Save posts every filled row.
- **Live Expense Statement** — a retractable live preview updates as you encode. Sections: Direct Cost and Operating Expenses, each with totals, ending in TOTAL EXPENSES. The % column shows each line's share of total expenses.
- **Editable entries** — every saved entry can be edited (date, category, description, amount) or deleted, with undo/redo (Ctrl+Z / Ctrl+Y).
- **Annual Reports** — "View Entire Year" combines all 12 months into an annual statement plus a month-by-month summary table.
- **Dashboard** — Direct Cost / Operating Expenses / Total Expenses cards, monthly trend chart, expense breakdown pie, recent transactions.
- **Print** — A4 portrait, company logo/name, report title, period, Prepared/Checked/Approved signature blocks, page numbers, print date (current month, selected quarter, or entire year).
- **Export PDF** — jsPDF + AutoTable, e.g. `ExpenseStatement_January_2025.pdf`, `ExpenseStatement_Q1_2025.pdf`, `ExpenseStatement_2025_Annual.pdf`.
- **Export Excel** — ExcelJS workbooks with Expense Statement, Transaction Details, Expense Breakdown, and Annual Summary worksheets; merged headers, accounting number format, borders, sensible column widths.
- **Search & filters** — description/category/month/year/date search plus year, month, quarter, category and date-range filters.
- **Settings** — company name, logo, address, TIN, currency, fiscal year, decimal places, dark mode.
- **SQLite storage** — Company, CostOfServices, OperatingExpenses, Users, AuditLogs and Settings tables kept in your Windows user profile (survives app updates).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl + N | New entry (jumps to the entry grid) |
| Ctrl + S | Save the pending entry rows |
| Ctrl + P | Print current statement |
| Ctrl + Shift + P | Export current month to PDF |
| Ctrl + E | Export current month to Excel |
| Ctrl + Z / Ctrl + Y | Undo / Redo |

## Getting started

```bash
npm install        # also rebuilds better-sqlite3 for Electron via postinstall
npm run dev        # starts Vite + Electron in development mode
```

If `better-sqlite3` complains about a Node ABI mismatch, run:

```bash
npm run rebuild
```

## Building the Windows installer

```bash
npm run build      # compiles main + renderer and produces an NSIS installer in /release
```

## Project structure

```
electron/          main process: window, SQLite (better-sqlite3), IPC, save dialogs
src/
  components/      shadcn-style UI kit, layout, entry grid/table, statement report, date picker
  pages/           Dashboard, Financial Entries, Expense Statement, Annual, Exports, Settings
  store/           Zustand stores (app state, entries with undo/redo, company)
  lib/             categories, calculations, formatting, PDF/Excel exporters
```

## Notes

- The database file lives at `%APPDATA%/financial-statement-generator/financial-statements.db`.
- Income tracking was removed at the client's request; the system tracks Direct Cost and Operating Expenses only, and the % column = line amount ÷ Total Expenses × 100.
- Existing entries under the old "Travel Expenses" category are automatically renamed to "Travel Expenses/Out of Town" on first launch.
