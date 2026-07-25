import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONTH_NAMES, YEARS } from "@/lib/categories";

interface DatePickerProps {
  value: string; // YYYY-MM-DD ("" allowed)
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseIso(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({ value, onChange, id, className, placeholder = "Pick a date" }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  // Keep the popup inside the window: flip to right-aligned / above when it would overflow
  const [alignRight, setAlignRight] = React.useState(false);
  const [openUp, setOpenUp] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const POPUP_W = 280;
    const POPUP_H = 360;
    setAlignRight(rect.left + POPUP_W > window.innerWidth - 8);
    setOpenUp(rect.bottom + POPUP_H > window.innerHeight - 8 && rect.top > POPUP_H);
  }, [open]);

  const today = new Date();
  const parsed = parseIso(value);

  // Month currently shown in the calendar
  const [viewYear, setViewYear] = React.useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(parsed?.m ?? today.getMonth() + 1); // 1-12

  React.useEffect(() => {
    const p = parseIso(value);
    if (p) {
      setViewYear(p.y);
      setViewMonth(p.m);
    }
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (d: number) =>
    parsed !== null && parsed.y === viewYear && parsed.m === viewMonth && parsed.d === d;
  const isToday = (d: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() + 1 === viewMonth &&
    today.getDate() === d;

  const label = parsed
    ? `${MONTH_NAMES[parsed.m - 1]} ${parsed.d}, ${parsed.y}`
    : placeholder;

  const pick = (d: number) => {
    onChange(toIso(viewYear, viewMonth, d));
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !parsed && "text-muted-foreground"
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 w-[280px] rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl",
            alignRight ? "right-0" : "left-0",
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {/* Header: month/year navigation */}
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="h-7 flex-1 rounded-md border border-input bg-background px-1 text-xs focus-visible:outline-none"
              aria-label="Month"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="h-7 w-[72px] rounded-md border border-input bg-background px-1 text-xs focus-visible:outline-none"
              aria-label="Year"
            >
              {(YEARS.includes(viewYear)
                ? YEARS
                : [...YEARS, viewYear].sort((a, b) => a - b)
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {cells.map((d, i) =>
              d === null ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "m-0.5 flex h-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent",
                    isSelected(d) &&
                      "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                    !isSelected(d) && isToday(d) && "border border-primary/60 font-medium"
                  )}
                >
                  {d}
                </button>
              )
            )}
          </div>

          {/* Footer */}
          <div className="mt-2 flex justify-between border-t pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(toIso(today.getFullYear(), today.getMonth() + 1, today.getDate()));
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
