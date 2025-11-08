"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, PermissionKey } from "@/types";
import { derivePermissions } from "@/utils/permissions";

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  permissions: PermissionKey[];
  setUser: (user: User, token?: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setPermissions: (permissions: PermissionKey[]) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      loading: false,
      permissions: [],
      setUser: (user, token) =>
        set(() => {
          if (token && typeof window !== "undefined") {
            localStorage.setItem("skillstorm_token", token);
          }
          return {
            user,
            token: token ?? null,
            permissions: derivePermissions(user),
          };
        }),
      logout: () =>
        set(() => {
          if (typeof window !== "undefined") {
            localStorage.removeItem("skillstorm_token");
          }
          return { user: null, token: null, permissions: [] };
        }),
      setLoading: (loading) => set(() => ({ loading })),
      setPermissions: (permissions) => set(() => ({ permissions })),
    }),
    {
      name: "skillstorm_auth",
      partialize: ({ token, user, permissions }) => ({
        token,
        user,
        permissions,
      }),
    },
  ),
);
