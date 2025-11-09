"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, PermissionKey } from "@/types";
import { derivePermissions } from "@/utils/permissions";

export type AuthState = {
  user: User | null;
  loading: boolean;
  permissions: PermissionKey[];
  setUser: (user: User | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setPermissions: (permissions: PermissionKey[]) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: false,
      permissions: [],
      setUser: (user) =>
        set(() => ({
          user,
          permissions: derivePermissions(user),
        })),
      logout: () => set(() => ({ user: null, permissions: [], loading: false })),
      setLoading: (loading) => set(() => ({ loading })),
      setPermissions: (permissions) => set(() => ({ permissions })),
    }),
    {
      name: "skillstorm_auth",
      partialize: ({ user, permissions }) => ({
        user,
        permissions,
      }),
    },
  ),
);
