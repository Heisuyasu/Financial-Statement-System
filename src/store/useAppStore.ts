import { create } from "zustand";
import type { PageId } from "@/types";
import { api } from "@/lib/api";
import { todayIso } from "@/lib/format";
import { lastDayOfMonth } from "@/lib/categories";

interface Notification {
  id: number;
  message: string;
  time: string;
  read: boolean;
}

interface AppState {
  page: PageId;
  /** Currently selected day (YYYY-MM-DD). year/month always match it. */
  date: string;
  year: number;
  month: number; // 1-12
  theme: "light" | "dark";
  searchQuery: string;
  notifications: Notification[];
  setPage: (page: PageId) => void;
  setDate: (date: string) => void;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  toggleTheme: () => void;
  setSearchQuery: (q: string) => void;
  notify: (message: string) => void;
  markAllRead: () => void;
  loadPersisted: () => Promise<void>;
}

let notifId = 1;

function parseIso(date: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function buildIso(y: number, m: number, d: number): string {
  const day = Math.min(d, lastDayOfMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  page: "dashboard",
  date: todayIso(),
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  theme: "light",
  searchQuery: "",
  notifications: [],

  setPage: (page) => set({ page }),

  setDate: (date) => {
    const p = parseIso(date);
    if (!p) return;
    set({ date, year: p.y, month: p.m });
    api.settings.set("lastDate", date);
  },

  setYear: (year) => {
    const p = parseIso(get().date);
    const date = buildIso(year, p?.m ?? 1, p?.d ?? 1);
    set({ year, date });
    api.settings.set("lastDate", date);
  },

  setMonth: (month) => {
    const p = parseIso(get().date);
    const date = buildIso(p?.y ?? get().year, month, p?.d ?? 1);
    set({ month, date });
    api.settings.set("lastDate", date);
  },

  toggleTheme: () => {
    const theme = get().theme === "dark" ? "light" : "dark";
    set({ theme });
    document.documentElement.classList.toggle("dark", theme === "dark");
    api.settings.set("theme", theme);
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  notify: (message) =>
    set((s) => ({
      notifications: [
        {
          id: notifId++,
          message,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: false,
        },
        ...s.notifications,
      ].slice(0, 30),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  loadPersisted: async () => {
    const settings = await api.settings.getAll();
    const patch: Partial<AppState> = {};
    if (settings.theme === "dark" || settings.theme === "light") {
      patch.theme = settings.theme;
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
    }
    const p = settings.lastDate ? parseIso(settings.lastDate) : null;
    if (p) {
      patch.date = settings.lastDate;
      patch.year = p.y;
      patch.month = p.m;
    }
    set(patch);
  },
}));
