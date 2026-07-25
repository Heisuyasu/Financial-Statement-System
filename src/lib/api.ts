import type { Entry, EntryInput, Company, Section, User, AuditLog } from "@/types";

/**
 * Typed wrapper around the Electron preload bridge (window.api).
 * When running in a plain browser (vite dev without Electron), an
 * in-memory fallback keeps the UI functional for development.
 */

interface Bridge {
  entries: {
    list: (year: number, month?: number) => Promise<Entry[]>;
    create: (input: EntryInput) => Promise<Entry>;
    update: (input: EntryInput & { id: number }) => Promise<Entry>;
    delete: (section: Section, id: number) => Promise<void>;
    search: (query: string, year?: number) => Promise<Entry[]>;
  };
  company: {
    get: () => Promise<Company>;
    update: (data: Omit<Company, "id">) => Promise<Company>;
  };
  settings: {
    getAll: () => Promise<Record<string, string>>;
    set: (key: string, value: string) => Promise<void>;
  };
  audit: { list: (limit?: number) => Promise<AuditLog[]> };
  user: { get: () => Promise<User> };
  file: {
    save: (
      options: { defaultName: string; filterName: string; extensions: string[] },
      data: ArrayBuffer
    ) => Promise<{ saved: boolean; path?: string }>;
  };
  logo: { pick: () => Promise<string | null> };
  db: {
    backup: () => Promise<{ saved: boolean; path?: string }>;
    restore: () => Promise<{ restored: boolean; error?: string }>;
    restoreFrom: (path: string) => Promise<{ restored: boolean; error?: string }>;
    autoBackups: () => Promise<
      { name: string; path: string; size: number; modified: string }[]
    >;
  };
}

declare global {
  interface Window {
    api?: Bridge;
  }
}

function createFallback(): Bridge {
  let nextId = 1;
  const store: Entry[] = [];
  let company: Company = {
    id: 1,
    name: "My Trucking Company",
    logo: "",
    address: "",
    tin: "",
    currency: "PHP",
    fiscalYearStart: 1,
    decimalPlaces: 2,
    preparedBy: "",
    checkedBy: "",
    approvedBy: "",
  };
  const settings: Record<string, string> = {};
  const logs: AuditLog[] = [];
  const now = () => new Date().toISOString();

  return {
    entries: {
      list: async (year, month) =>
        store.filter((e) => e.year === year && (month ? e.month === month : true)),
      create: async (input) => {
        const entry: Entry = {
          ...input,
          vat: input.vat ?? 0,
          account: input.account ?? "",
          paymentMode: input.paymentMode ?? "",
          supplier: input.supplier ?? "",
          breakdown: input.breakdown ?? "",
          id: input.id ?? nextId++,
          createdAt: now(),
          updatedAt: now(),
        };
        store.push(entry);
        return entry;
      },
      update: async (input) => {
        const i = store.findIndex((e) => e.id === input.id && e.section === input.section);
        if (i < 0) throw new Error(`Entry not found: ${input.section}/${input.id}`);
        store[i] = { ...store[i], ...input, updatedAt: now() };
        return store[i];
      },
      delete: async (section, id) => {
        const i = store.findIndex((e) => e.id === id && e.section === section);
        if (i >= 0) store.splice(i, 1);
      },
      search: async (query, year) => {
        const q = query.toLowerCase();
        return store.filter(
          (e) =>
            (!year || e.year === year) &&
            (e.description.toLowerCase().includes(q) ||
              e.category.toLowerCase().includes(q) ||
              e.date.includes(q) ||
              String(e.year).includes(q) ||
              String(e.month).includes(q))
        );
      },
    },
    company: {
      get: async () => company,
      update: async (data) => {
        company = { ...company, ...data };
        return company;
      },
    },
    settings: {
      getAll: async () => settings,
      set: async (key, value) => {
        settings[key] = value;
      },
    },
    audit: { list: async () => logs },
    user: {
      get: async () => ({
        id: 1,
        name: "Administrator",
        email: "",
        role: "Admin",
        createdAt: now(),
      }),
    },
    file: {
      save: async (options, data) => {
        // Browser fallback: trigger a download.
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = options.defaultName;
        a.click();
        URL.revokeObjectURL(url);
        return { saved: true };
      },
    },
    logo: { pick: async () => null },
    db: {
      backup: async () => ({ saved: false }),
      restore: async () => ({
        restored: false,
        error: "Backup and restore are only available in the desktop app.",
      }),
      restoreFrom: async () => ({
        restored: false,
        error: "Backup and restore are only available in the desktop app.",
      }),
      autoBackups: async () => [],
    },
  };
}

export const api: Bridge = window.api ?? createFallback();
export const isElectron = Boolean(window.api);
