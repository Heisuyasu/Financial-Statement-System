import { create } from "zustand";
import type { Section } from "@/types";
import { api } from "@/lib/api";
import { CATEGORIES_BY_SECTION } from "@/lib/categories";

const SETTINGS_KEY = "customCategories";

type CustomMap = Record<Section, string[]>;

interface CategoriesState {
  custom: CustomMap;
  loaded: boolean;
  load: () => Promise<void>;
  add: (section: Section, name: string) => Promise<void>;
  remove: (section: Section, name: string) => Promise<void>;
}

const empty: CustomMap = { income: [], cos: [], opex: [] };

async function persist(custom: CustomMap) {
  await api.settings.set(SETTINGS_KEY, JSON.stringify(custom));
}

function sanitize(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  custom: empty,
  loaded: false,

  load: async () => {
    const settings = await api.settings.getAll();
    let custom: CustomMap = { income: [], cos: [], opex: [] };
    try {
      const raw = settings[SETTINGS_KEY];
      if (raw) {
        const parsed = JSON.parse(raw);
        custom = {
          income: sanitize(parsed?.income),
          cos: sanitize(parsed?.cos),
          opex: sanitize(parsed?.opex),
        };
      }
    } catch {
      custom = { income: [], cos: [], opex: [] };
    }
    set({ custom, loaded: true });
  },

  add: async (section, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Reject if it already exists as a built-in or custom category in that section.
    const builtIn = CATEGORIES_BY_SECTION[section].map((c) => c.toLowerCase());
    const current = get().custom[section];
    const lower = trimmed.toLowerCase();
    if (builtIn.includes(lower) || current.some((c) => c.toLowerCase() === lower)) return;

    const custom: CustomMap = {
      ...get().custom,
      [section]: [...current, trimmed].sort((a, b) => a.localeCompare(b)),
    };
    set({ custom });
    await persist(custom);
  },

  remove: async (section, name) => {
    const custom: CustomMap = {
      ...get().custom,
      [section]: get().custom[section].filter((c) => c !== name),
    };
    set({ custom });
    await persist(custom);
  },
}));
