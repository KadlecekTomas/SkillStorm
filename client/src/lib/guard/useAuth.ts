"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuthStore, type OrganizationContext } from "@/store/use-auth-store";
import type { OrganizationRole, PermissionKey, User } from "@/types";
import { showToastOnce } from "@/utils/toast";
import { AUTH_DEBUG } from "@/utils/env";
import { audit } from "@/lib/audit/audit.client";

type AuthEnvelope = {
  user: User;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
};

export type UseAuthResult = {
  user: User | null;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  isLoading: boolean;
  isAuthenticated: boolean;
  hasOrganization: boolean;
  authStatus: "booting" | "ready";
  isOffline: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  syncProfile: (options?: { force?: boolean }) => Promise<AuthEnvelope>;
  switchOrganization: (orgId: string) => Promise<void>;
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

export const useAuth = (): UseAuthResult => {
  const pathname = usePathname();
  const syncRef = useRef<Promise<AuthEnvelope> | null>(null);
  const {
    user,
    org,
    roles,
    permissions,
    loading,
    authStatus,
    offline,
    hydrated,
    setProfile,
    setLoading,
    setAuthStatus,
    setOffline,
    setSessionToken,
    logout: clearStore,
  } = useAuthStore((state) => ({
    user: state.user,
    org: state.org,
    roles: state.roles,
    permissions: state.permissions,
    loading: state.loading,
    authStatus: state.authStatus,
    offline: state.offline,
    hydrated: state.hydrated,
    setProfile: state.setProfile,
    setLoading: state.setLoading,
    setAuthStatus: state.setAuthStatus,
    setOffline: state.setOffline,
    setSessionToken: state.setSessionToken,
    logout: state.logout,
  }));

  const syncProfile = useCallback(
    async (options?: { force?: boolean }) => {
      if (syncRef.current) {
        return syncRef.current;
      }
      syncRef.current = (async () => {
        setLoading(true);
        if (AUTH_DEBUG) {
          console.log(
            "%c[AUTH][BOOT]",
            "color:#2563eb;font-weight:600",
            { pathname, hydrated, authStatus, loading, userId: user?.id ?? null },
          );
        }
        try {
          let attempt = 0;
          while (true) {
            try {
              const profile = await fetchWithAuth<AuthEnvelope>("GET", "/auth/me", {
                retries: options?.force ? 0 : null,
              });
              setProfile(profile);
              return profile;
            } catch (error) {
              if (attempt < 2) {
                attempt += 1;
                await delay(250 * attempt);
                continue;
              }
              clearStore();
              throw error;
            }
          }
        } finally {
          setAuthStatus("ready");
          setLoading(false);
          syncRef.current = null;
          if (AUTH_DEBUG) {
            console.log(
              "%c[AUTH][READY]",
              "color:#0f766e;font-weight:600",
              { pathname, hydrated, authStatus: "ready", userId: user?.id ?? null },
            );
          }
        }
      })();
      return syncRef.current;
    },
    [setLoading, setProfile, setAuthStatus, clearStore, pathname, hydrated, authStatus, loading, user?.id],
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
    if (!AUTH_DEBUG) return;
    console.log(
      "%c[AUTH][STATE]",
      "color:#9333ea;font-weight:600",
      { pathname, hydrated, authStatus, loading, userId: user?.id ?? null },
    );
  }, [pathname, hydrated, authStatus, loading, user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    if (loading) return;
    if (authStatus === "ready") return;
    syncProfile().catch(() => {
      // Guard handles unauthenticated redirect after bootstrap.
    });
  }, [hydrated, loading, authStatus, syncProfile]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const loginResult = await fetchWithAuth<AuthResponse | undefined>("POST", "/auth/login", {
          body: payload,
        });
        const incomingToken = loginResult?.sessionToken;
        if (typeof incomingToken === "string" && incomingToken.length > 0) {
          setSessionToken(incomingToken);
        }
        audit({ action: "LOGIN" });
        showToastOnce("Přihlášení proběhlo úspěšně! 🎉", { type: "success" });
      } catch (error) {
        showToastOnce("Neplatné přihlašovací údaje ❌", { type: "error" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setSessionToken],
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
    }
  }, [clearStore, org?.id, setSessionToken]);

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

  const hasOrganization = Boolean(org?.id);

  const value = useMemo(
    () => ({
      user,
      org,
      roles,
      permissions,
      isLoading: loading || !hydrated || authStatus === "booting",
      isAuthenticated: Boolean(user),
      hasOrganization,
      authStatus,
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
      authStatus,
      hydrated,
      offline,
      hasOrganization,
      login,
      logout,
      syncProfile,
      switchOrganization,
    ],
  );

  return value;
};
