import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  Moon,
  Search,
  Sun,
  User as UserIcon,
  CalendarDays,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useCompanyStore } from "@/store/useCompanyStore";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { MONTH_NAMES, YEARS } from "@/lib/categories";

export function TopNav() {
  const { year, month, setYear, setMonth, theme, toggleTheme, notifications, markAllRead, setPage, searchQuery, setSearchQuery } =
    useAppStore();
  const { company, user } = useCompanyStore();
  const [searchOpen, setSearchOpen] = useState(false);

  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <header className="no-print flex h-16 shrink-0 items-center gap-3 border-b bg-card px-5 shadow-sm">
      {/* Company */}
      <div className="flex min-w-0 items-center gap-3">
        {company?.logo ? (
          <img
            src={company.logo}
            alt="logo"
            className="h-9 w-9 rounded-lg border object-contain"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFCEE3] text-[#021A54]">
            <Building2 className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight">
            {company?.name ?? "Financial Statement Generator"}
          </div>
          <div className="text-[11px] font-medium leading-tight text-muted-foreground">
            {MONTH_NAMES[month - 1]} {year}
          </div>
        </div>
      </div>

      <div className="mx-2 h-8 w-px bg-border" />

      {/* Period selectors */}
      <div className="flex items-center gap-1.5 rounded-full border bg-background/60 py-1 pl-3 pr-1.5">
        <CalendarDays className="h-4 w-4 text-[#FF85BB]" />
        <Select
          aria-label="Month"
          className="h-7 w-[118px] border-0 bg-transparent shadow-none focus-visible:ring-0"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Year"
          className="h-7 w-[84px] border-0 bg-transparent shadow-none focus-visible:ring-0"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search entries…"
          className="rounded-full border-transparent bg-muted pl-9 focus-visible:border-input focus-visible:bg-background"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value && !searchOpen) {
              setSearchOpen(true);
              setPage("entries");
            }
          }}
        />
      </div>

      {/* Dark mode */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={toggleTheme}
        title="Toggle dark mode"
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      {/* Notifications */}
      <Dropdown
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            title="Notifications"
            onClick={markAllRead}
          >
            <div className="relative">
              <Bell />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF85BB] px-1 text-[10px] font-bold text-[#021A54]">
                  {unread}
                </span>
              )}
            </div>
          </Button>
        }
      >
        <DropdownLabel>Notifications</DropdownLabel>
        <DropdownSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.slice(0, 8).map((n) => (
            <div key={n.id} className="px-2 py-1.5 text-sm">
              <div className="truncate">{n.message}</div>
              <div className="text-[11px] text-muted-foreground">{n.time}</div>
            </div>
          ))
        )}
      </Dropdown>

      {/* User profile */}
      <Dropdown
        trigger={
          <Button variant="ghost" className="gap-2 rounded-full px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#021A54] to-[#33509B] text-white ring-2 ring-[#FFCEE3]">
              <UserIcon className="h-4 w-4" />
            </div>
            <span className="hidden text-sm font-semibold lg:inline">
              {user?.name ?? "User"}
            </span>
          </Button>
        }
      >
        <DropdownLabel>
          {user?.name ?? "User"} · {user?.role ?? ""}
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownItem onClick={() => setPage("settings")}>Settings</DropdownItem>
        <DropdownItem onClick={() => setPage("exports")}>Exports</DropdownItem>
      </Dropdown>
    </header>
  );
}
