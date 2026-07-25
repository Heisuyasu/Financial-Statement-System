import { useEffect } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { Dashboard } from "@/pages/Dashboard";
import { FinancialEntries } from "@/pages/FinancialEntries";
import { IncomeStatementPage } from "@/pages/IncomeStatementPage";
import { AnnualReports } from "@/pages/AnnualReports";
import { CustomerReportPage } from "@/pages/CustomerReportPage";
import { ExportsPage } from "@/pages/ExportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useAppStore } from "@/store/useAppStore";
import { useEntriesStore } from "@/store/useEntriesStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { useCategoriesStore } from "@/store/useCategoriesStore";
import { useAccountsStore } from "@/store/useAccountsStore";
import { useReportActions } from "@/hooks/useReportActions";

export default function App() {
  const { page, year, month, setPage, loadPersisted } = useAppStore();
  const { loadYear, undo, redo } = useEntriesStore();
  const { load: loadCompany } = useCompanyStore();
  const { load: loadCategories } = useCategoriesStore();
  const { load: loadAccounts } = useAccountsStore();
  const { exportPdf, exportXlsx } = useReportActions();

  // Initial load
  useEffect(() => {
    loadPersisted();
    loadCompany();
    loadCategories();
    loadAccounts();
  }, [loadPersisted, loadCompany, loadCategories, loadAccounts]);

  // Reload all data when the year changes
  useEffect(() => {
    loadYear(year);
  }, [year, loadYear]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      // While typing in a field, let the browser's native text undo/redo work
      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);
      if ((key === "z" || key === "y") && isTyping) return;

      if (key === "n") {
        e.preventDefault();
        setPage("entries");
        setTimeout(() => {
          document.getElementById("g-date")?.focus();
        }, 100);
      } else if (key === "s") {
        e.preventDefault();
        const form = document.getElementById("entry-form") as HTMLFormElement | null;
        form?.requestSubmit();
      } else if (key === "p" && e.shiftKey) {
        e.preventDefault();
        exportPdf({ kind: "month", year, month });
      } else if (key === "p") {
        e.preventDefault();
        if (useAppStore.getState().page !== "statement") setPage("statement");
        setTimeout(() => window.dispatchEvent(new CustomEvent("app:print")), 250);
      } else if (key === "e") {
        e.preventDefault();
        exportXlsx({ kind: "month", year, month });
      } else if (key === "z") {
        e.preventDefault();
        undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [year, month, setPage, exportPdf, exportXlsx, undo, redo]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {page === "dashboard" && <Dashboard />}
            {page === "entries" && <FinancialEntries />}
            {page === "statement" && <IncomeStatementPage />}
            {page === "annual" && <AnnualReports />}
            {page === "customers" && <CustomerReportPage />}
            {page === "exports" && <ExportsPage />}
            {page === "settings" && <SettingsPage />}
          </div>
        </main>
      </div>
    </div>
  );
}
