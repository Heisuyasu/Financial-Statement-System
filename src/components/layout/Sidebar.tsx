import {
  LayoutDashboard,
  ListPlus,
  FileText,
  CalendarRange,
  Users,
  Download,
  Settings,
  BarChart3,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import type { PageId } from "@/types";

const NAV: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "entries", label: "Financial Entries", icon: ListPlus },
  { id: "statement", label: "Expense Statement", icon: FileText },
  { id: "annual", label: "Annual Reports", icon: CalendarRange },
  { id: "customers", label: "Customer Report", icon: Users },
  { id: "exports", label: "Exports", icon: Download },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { page, setPage } = useAppStore();

  return (
    <aside className="no-print flex w-60 shrink-0 flex-col bg-[#021A54] text-white dark:border-r dark:border-border">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF85BB] to-[#FFCEE3] text-[#021A54] shadow-lg shadow-[#FF85BB]/20">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide">Financial Statement</div>
          <div className="text-[11px] font-medium text-[#FFCEE3]/70">Generator</div>
        </div>
      </div>

      <div className="mx-5 mb-4 h-px bg-white/10" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[#FF85BB] text-[#021A54] shadow-lg shadow-[#FF85BB]/25"
                  : "text-white/65 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform",
                  active ? "" : "group-hover:scale-110"
                )}
              />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#021A54]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Shortcuts */}
      <div className="mx-3 mb-4 rounded-xl bg-white/5 p-4 text-sm leading-relaxed text-white/60">
        <div className="mb-1.5 text-base font-semibold text-[#FFCEE3]">Keyboard shortcuts</div>
        Ctrl+N New entry · Ctrl+S Save
        <br />
        Ctrl+P Print · Ctrl+Shift+P PDF
        <br />
        Ctrl+E Excel · Ctrl+Z/Y Undo/Redo
      </div>
    </aside>
  );
}
