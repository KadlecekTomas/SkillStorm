"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  setUser: (user: User, token?: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      loading: false,
      setUser: (user, token) =>
        set(() => {
          if (token && typeof window !== "undefined") {
            localStorage.setItem("skillstorm_token", token);
          }
          return { user, token: token ?? null };
        }),
      logout: () =>
        set(() => {
          if (typeof window !== "undefined") {
            localStorage.removeItem("skillstorm_token");
          }
          return { user: null, token: null };
        }),
      setLoading: (loading) => set(() => ({ loading })),
    }),
    {
      name: "skillstorm_auth",
      partialize: ({ token, user }) => ({ token, user }),
    },
  ),
);
