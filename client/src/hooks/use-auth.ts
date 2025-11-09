"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiClient } from "@/utils/api-client";
import { useAuthStore } from "@/store/use-auth-store";
import type { User } from "@/types";
import { AxiosError } from "axios";
import { getRoleHomePath } from "@/utils/permissions";
import { showToastOnce } from "@/utils/toast";

type LoginPayload = {
  login: string;
  password: string;
};

export const useAuth = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    setUser,
    logout: clearStore,
    loading,
    setLoading,
    permissions,
  } = useAuthStore(
    (state) => ({
      user: state.user,
      setUser: state.setUser,
      logout: state.logout,
      loading: state.loading,
      setLoading: state.setLoading,
      permissions: state.permissions,
    }),
  );
  const [initializing, setInitializing] = useState(true);
  const isAuthPage =
    pathname?.startsWith("/login") || pathname?.startsWith("/register");

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get<User>("/auth/me");
      if (data) {
        const normalized: User = {
          ...data,
          organizationRole: data.organizationRole ?? null,
          organizationId: data.organizationId ?? null,
        };
        setUser(normalized);
        return normalized;
      }
      return null;
    } catch (error) {
      clearStore();
      throw error;
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }, [setUser, setLoading, clearStore]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        setLoading(true);
        const { data } = await apiClient.post("/auth/login", payload);
        if (data?.user) {
          setUser(data.user);
        }
        const profile = await fetchProfile();
        showToastOnce("Přihlášení proběhlo úspěšně! 🎉", { type: "success" });
        const destination = getRoleHomePath(profile ?? data?.user ?? null);
        router.replace(destination);
      } catch (error: unknown) {
        const message =
          error instanceof AxiosError
            ? (error.response?.data as { message?: string })?.message ??
              "Neplatné přihlašovací údaje ❌"
            : error instanceof Error
              ? error.message
              : "Neplatné přihlašovací údaje ❌";
        showToastOnce(message, { type: "error" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [fetchProfile, router, setLoading, setUser],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore server errors on logout
    } finally {
      clearStore();
      showToastOnce("Byl jsi úspěšně odhlášen 👋", { type: "info" });
      router.replace("/login");
    }
  }, [clearStore, router]);

  useEffect(() => {
    if (user) {
      setInitializing(false);
      return;
    }
    if (isAuthPage) {
      setInitializing(false);
      return;
    }
    fetchProfile().catch(() => {
      if (!isAuthPage) {
        showToastOnce("Relace vypršela. Přihlas se znovu.", { type: "error" });
        router.replace("/login");
      } else {
        setInitializing(false);
      }
    });
  }, [user, fetchProfile, router, isAuthPage]);

  const isAuthenticated = useMemo(() => !!user, [user]);

  return {
    user,
    isAuthenticated,
    initializing,
    loading,
    permissions,
    login,
    logout,
  };
};
