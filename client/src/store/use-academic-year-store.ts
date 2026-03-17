"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type AcademicYearState = {
  selectedByOrg: Record<string, string>;
  setSelected: (orgId: string, yearId: string) => void;
  clearOrg: (orgId: string) => void;
  clearAll: () => void;
};

export const useAcademicYearStore = create<AcademicYearState>()(
  persist(
    (set) => ({
      selectedByOrg: {},
      setSelected: (orgId, yearId) =>
        set((state) => ({
          selectedByOrg: { ...state.selectedByOrg, [orgId]: yearId },
        })),
      clearOrg: (orgId) =>
        set((state) => {
          const next = { ...state.selectedByOrg };
          delete next[orgId];
          return { selectedByOrg: next };
        }),
      clearAll: () => set(() => ({ selectedByOrg: {} })),
    }),
    { name: "skillstorm_academic_year" },
  ),
);
