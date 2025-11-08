"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { apiClient } from "@/utils/api-client";
import { useAuthStore } from "@/store/use-auth-store";
import type { User } from "@/types";
import { AxiosError } from "axios";
import { getRoleHomePath } from "@/utils/permissions";

type LoginPayload = {
  login: string;
  password: string;
};

export const useAuth = () => {
  const router = useRouter();
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

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get<User>("/auth/me");
      if (data) {
        const normalized: User = {
          ...user,
          ...data,
          organizationRole: data.organizationRole ?? user?.organizationRole ?? null,
          organizationId: data.organizationId ?? user?.organizationId ?? null,
        };
        setUser(normalized);
        return normalized;
      }
    } catch (error) {
      clearStore();
      throw error;
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }, [setUser, setLoading, clearStore, user]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        setLoading(true);
        const { data } = await apiClient.post("/auth/login", payload);
        const token = data?.accessToken ?? data?.token;
        if (token && typeof window !== "undefined") {
          localStorage.setItem("skillstorm_token", token);
        }
        if (data?.user) {
          setUser(data.user, token);
        }
        const profile = await fetchProfile();
        toast.success("Přihlášení proběhlo úspěšně! 🎉");
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
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [fetchProfile, router, setLoading, setUser],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout").catch(() => undefined);
    } catch {
      // ignore
    } finally {
      clearStore();
      toast.success("Byl jsi úspěšně odhlášen 👋");
      router.replace("/auth/login");
    }
  }, [clearStore, router]);

  useEffect(() => {
    if (user) {
      setInitializing(false);
      return;
    }
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("skillstorm_token");
    if (!token) {
      setInitializing(false);
      return;
    }
    fetchProfile().catch(() => {
      toast.error("Relace vypršela. Přihlas se znovu.");
      router.replace("/auth/login");
    });
  }, [user, fetchProfile, router]);

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
