import { create } from "zustand";
import type { Entry, EntryInput } from "@/types";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

type UndoAction =
  | { type: "create"; entry: Entry }
  | { type: "update"; before: Entry; after: Entry }
  | { type: "delete"; entry: Entry }
  | { type: "bulkDelete"; entries: Entry[] };

interface EntriesState {
  /** All entries for the currently loaded year. */
  entries: Entry[];
  loadedYear: number | null;
  loading: boolean;
  undoStack: UndoAction[];
  redoStack: UndoAction[];

  loadYear: (year: number) => Promise<void>;
  addEntry: (input: EntryInput) => Promise<void>;
  editEntry: (input: EntryInput & { id: number }) => Promise<void>;
  removeEntry: (entry: Entry) => Promise<void>;
  removeMany: (toDelete: Entry[]) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const sameRecord = (a: Entry, b: { id: number; section: Entry["section"] }) =>
  a.id === b.id && a.section === b.section;

export const useEntriesStore = create<EntriesState>((set, get) => ({
  entries: [],
  loadedYear: null,
  loading: false,
  undoStack: [],
  redoStack: [],

  loadYear: async (year) => {
    set({ loading: true });
    const entries = await api.entries.list(year);
    set({ entries, loadedYear: year, loading: false });
  },

  addEntry: async (input) => {
    const entry = await api.entries.create(input);
    set((s) => ({
      entries:
        entry.year === s.loadedYear ? [...s.entries, entry] : s.entries,
      undoStack: [...s.undoStack, { type: "create", entry }],
      redoStack: [],
    }));
    useAppStore
      .getState()
      .notify(
        `Added ${input.category} — ${(
          Math.round((input.amount + (input.vat ?? 0)) * 100) / 100
        ).toLocaleString()}`
      );
  },

  editEntry: async (input) => {
    const before = get().entries.find((e) => sameRecord(e, input));
    const after = await api.entries.update(input);
    set((s) => ({
      // If the edit moved the entry into another year, drop it from this year's list
      entries:
        after.year === s.loadedYear
          ? s.entries.map((e) => (sameRecord(e, input) ? after : e))
          : s.entries.filter((e) => !sameRecord(e, input)),
      undoStack: before
        ? [...s.undoStack, { type: "update", before, after }]
        : s.undoStack,
      redoStack: [],
    }));
    useAppStore.getState().notify(`Updated ${input.category}`);
  },

  removeEntry: async (entry) => {
    await api.entries.delete(entry.section, entry.id);
    set((s) => ({
      entries: s.entries.filter((e) => !sameRecord(e, entry)),
      undoStack: [...s.undoStack, { type: "delete", entry }],
      redoStack: [],
    }));
    useAppStore.getState().notify(`Deleted ${entry.category}`);
  },

  removeMany: async (toDelete) => {
    if (toDelete.length === 0) return;
    for (const entry of toDelete) {
      await api.entries.delete(entry.section, entry.id);
    }
    const keys = new Set(toDelete.map((e) => `${e.section}|${e.id}`));
    set((s) => ({
      entries: s.entries.filter((e) => !keys.has(`${e.section}|${e.id}`)),
      undoStack: [...s.undoStack, { type: "bulkDelete", entries: toDelete }],
      redoStack: [],
    }));
    useAppStore
      .getState()
      .notify(`Deleted ${toDelete.length} entr${toDelete.length === 1 ? "y" : "ies"} (Ctrl+Z to undo)`);
  },

  undo: async () => {
    const { undoStack } = get();
    const action = undoStack[undoStack.length - 1];
    if (!action) return;
    set({ undoStack: undoStack.slice(0, -1) });

    if (action.type === "create") {
      await api.entries.delete(action.entry.section, action.entry.id);
      set((s) => ({
        entries: s.entries.filter((e) => !sameRecord(e, action.entry)),
        redoStack: [...s.redoStack, action],
      }));
    } else if (action.type === "delete") {
      const restored = await api.entries.create({ ...action.entry });
      set((s) => ({
        entries: [...s.entries, restored],
        redoStack: [...s.redoStack, { type: "delete", entry: restored }],
      }));
    } else if (action.type === "bulkDelete") {
      const restored: Entry[] = [];
      for (const entry of action.entries) {
        restored.push(await api.entries.create({ ...entry }));
      }
      set((s) => ({
        entries: [...s.entries, ...restored],
        redoStack: [...s.redoStack, { type: "bulkDelete", entries: restored }],
      }));
    } else {
      const restored = await api.entries.update({ ...action.before, id: action.before.id });
      set((s) => {
        const base = s.entries.filter((e) => !sameRecord(e, restored));
        return {
          entries: restored.year === s.loadedYear ? [...base, restored] : base,
          redoStack: [...s.redoStack, action],
        };
      });
    }
    useAppStore.getState().notify("Undo");
  },

  redo: async () => {
    const { redoStack } = get();
    const action = redoStack[redoStack.length - 1];
    if (!action) return;
    set({ redoStack: redoStack.slice(0, -1) });

    if (action.type === "create") {
      const restored = await api.entries.create({ ...action.entry });
      set((s) => ({
        entries: [...s.entries, restored],
        undoStack: [...s.undoStack, { type: "create", entry: restored }],
      }));
    } else if (action.type === "delete") {
      await api.entries.delete(action.entry.section, action.entry.id);
      set((s) => ({
        entries: s.entries.filter((e) => !sameRecord(e, action.entry)),
        undoStack: [...s.undoStack, action],
      }));
    } else if (action.type === "bulkDelete") {
      for (const entry of action.entries) {
        await api.entries.delete(entry.section, entry.id);
      }
      const keys = new Set(action.entries.map((e) => `${e.section}|${e.id}`));
      set((s) => ({
        entries: s.entries.filter((e) => !keys.has(`${e.section}|${e.id}`)),
        undoStack: [...s.undoStack, action],
      }));
    } else {
      const restored = await api.entries.update({ ...action.after, id: action.after.id });
      set((s) => {
        const base = s.entries.filter((e) => !sameRecord(e, restored));
        return {
          entries: restored.year === s.loadedYear ? [...base, restored] : base,
          undoStack: [...s.undoStack, action],
        };
      });
    }
    useAppStore.getState().notify("Redo");
  },
}));

/** Entries for the currently selected month. */
export function selectMonthEntries(entries: Entry[], month: number): Entry[] {
  return entries.filter((e) => e.month === month);
}
