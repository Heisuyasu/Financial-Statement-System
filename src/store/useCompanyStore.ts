import { create } from "zustand";
import type { Company, User } from "@/types";
import { api } from "@/lib/api";

interface CompanyState {
  company: Company | null;
  user: User | null;
  load: () => Promise<void>;
  save: (data: Omit<Company, "id">) => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  user: null,

  load: async () => {
    const [company, user] = await Promise.all([api.company.get(), api.user.get()]);
    set({ company, user });
  },

  save: async (data) => {
    const company = await api.company.update(data);
    set({ company });
  },
}));
