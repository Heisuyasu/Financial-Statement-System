import { create } from "zustand";
import { api } from "@/lib/api";

const SETTINGS_KEY = "accounts";

interface AccountsState {
  accounts: string[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (name: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
}

async function persist(accounts: string[]) {
  await api.settings.set(SETTINGS_KEY, JSON.stringify(accounts));
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  loaded: false,

  load: async () => {
    const settings = await api.settings.getAll();
    let accounts: string[] = [];
    try {
      const raw = settings[SETTINGS_KEY];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) accounts = parsed.filter((x) => typeof x === "string");
      }
    } catch {
      accounts = [];
    }
    set({ accounts, loaded: true });
  },

  add: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = get().accounts;
    if (existing.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return;
    const accounts = [...existing, trimmed].sort((a, b) => a.localeCompare(b));
    set({ accounts });
    await persist(accounts);
  },

  remove: async (name) => {
    const accounts = get().accounts.filter((a) => a !== name);
    set({ accounts });
    await persist(accounts);
  },
}));
