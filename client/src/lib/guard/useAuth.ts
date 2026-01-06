"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuthStore, type OrganizationContext } from "@/store/use-auth-store";
import type { OrganizationRole, PermissionKey, User } from "@/types";
import { getRoleHomePath } from "@/utils/permissions";
import { showToastOnce } from "@/utils/toast";
import { audit } from "@/lib/audit/audit.client";

type AuthEnvelope = {
  user: User;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
};

type AuthResponse = AuthEnvelope & {
  sessionToken?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isAuthRoute = (pathname: string | null) => {
  if (!pathname) return false;
  return pathname.startsWith("/login") || pathname.startsWith("/register");
};

export const useAuth = () => {
  const router = useRouter();
  const pathname = usePathname();
  const retryRef = useRef(0);
  const {
    user,
    org,
    roles,
    permissions,
    loading,
    offline,
    sessionToken,
    hydrated,
    setProfile,
    setLoading,
    setOffline,
    setSessionToken,
    logout: clearStore,
  } = useAuthStore((state) => ({
    user: state.user,
    org: state.org,
    roles: state.roles,
    permissions: state.permissions,
    loading: state.loading,
    offline: state.offline,
    hydrated: state.hydrated,
    setProfile: state.setProfile,
    setLoading: state.setLoading,
    setOffline: state.setOffline,
    sessionToken: state.sessionToken,
    setSessionToken: state.setSessionToken,
    logout: state.logout,
  }));

  const syncProfile = useCallback(
    async (options?: { force?: boolean }) => {
      setLoading(true);
      try {
        const profile = await fetchWithAuth<AuthEnvelope>("GET", "/auth/me", {
          retries: options?.force ? 0 : null,
        });
        setProfile(profile);
        retryRef.current = 0;
        return profile;
      } catch (error) {
        if (retryRef.current < 2) {
          retryRef.current += 1;
          await delay(250 * retryRef.current);
          return syncProfile(options);
        }
        retryRef.current = 0;
        clearStore();
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setProfile, clearStore],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateStatus = () => setOffline(!navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, [setOffline]);

  useEffect(() => {
    if (!hydrated) return;
    if (user || loading || isAuthRoute(pathname)) return;
    syncProfile().catch(() => {
      if (!isAuthRoute(pathname)) {
        router.replace("/login");
      }
    });
  }, [hydrated, user, loading, pathname, router, syncProfile]);

  useEffect(() => {
    if (!user || org || isAuthRoute(pathname)) return;
    if (pathname?.startsWith("/select-organization")) return;
    router.replace("/select-organization");
  }, [user, org, pathname, router]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const loginResult = await fetchWithAuth<AuthResponse>("POST", "/auth/login", {
          body: payload,
        });
        const { sessionToken: incomingToken } = loginResult;
        setSessionToken(incomingToken ?? sessionToken ?? null);
        const profile = await syncProfile({ force: true });
        audit({
          action: "LOGIN",
          ...(profile?.org?.id ? { entityId: profile.org.id } : {}),
        });
        showToastOnce("Přihlášení proběhlo úspěšně! 🎉", { type: "success" });
        router.replace(getRoleHomePath(profile.user));
      } catch (error) {
        showToastOnce("Neplatné přihlašovací údaje ❌", { type: "error" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [router, setLoading, setProfile, sessionToken, syncProfile],
  );

  const logout = useCallback(async () => {
    try {
      await fetchWithAuth("POST", "/auth/logout");
    } catch {
      // ignore request errors during logout
    } finally {
      audit({
        action: "LOGOUT",
        ...(org?.id ? { entityId: org.id } : {}),
      });
      clearStore();
      setSessionToken(null);
      router.replace("/login");
    }
  }, [router, clearStore, org?.id]);

  const switchOrganization = useCallback(
    async (orgId: string) => {
      setLoading(true);
      try {
        await fetchWithAuth("POST", "/auth/use-org", { body: { orgId } });
        await syncProfile({ force: true });
        showToastOnce("Přepnuli jsme aktivní organizaci.", {
          type: "info",
        });
      } catch (error) {
        showToastOnce("Nepodařilo se přepnout organizaci.", { type: "error" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, syncProfile],
  );

  const value = useMemo(
    () => ({
      user,
      org,
      roles,
      permissions,
      isLoading: loading,
      isAuthenticated: Boolean(user),
      isOffline: offline,
      login,
      logout,
      syncProfile,
      switchOrganization,
    }),
    [
      user,
      org,
      roles,
      permissions,
      loading,
      offline,
      login,
      logout,
      syncProfile,
      switchOrganization,
    ],
  );

  return value;
};
