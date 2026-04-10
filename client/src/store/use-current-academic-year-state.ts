"use client";

import { create } from "zustand";

export type CurrentAcademicYearRequirementStatus = "unknown" | "ok" | "missing";

type CurrentAcademicYearRequirementRecord = {
  status: CurrentAcademicYearRequirementStatus;
  errorCode?: string | null;
  returnPath?: string | null;
};

type CurrentAcademicYearRequirementState = {
  byOrg: Record<string, CurrentAcademicYearRequirementRecord>;
  markMissing: (orgId: string, options?: { errorCode?: string | null; returnPath?: string | null }) => void;
  markAvailable: (orgId: string) => void;
  resetOrg: (orgId: string) => void;
  clearAll: () => void;
};

export const useCurrentAcademicYearState = create<CurrentAcademicYearRequirementState>()(
  (set) => ({
    byOrg: {},
    markMissing: (orgId, options) =>
      set((state) => ({
        byOrg: {
          ...state.byOrg,
          [orgId]: {
            status: "missing",
            errorCode: options?.errorCode ?? null,
            returnPath: options?.returnPath ?? null,
          },
        },
      })),
    markAvailable: (orgId) =>
      set((state) => ({
        byOrg: {
          ...state.byOrg,
          [orgId]: {
            status: "ok",
            errorCode: null,
            returnPath: state.byOrg[orgId]?.returnPath ?? null,
          },
        },
      })),
    resetOrg: (orgId) =>
      set((state) => {
        const next = { ...state.byOrg };
        delete next[orgId];
        return { byOrg: next };
      }),
    clearAll: () => set(() => ({ byOrg: {} })),
  }),
);
