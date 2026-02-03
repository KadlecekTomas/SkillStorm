"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuthStore, type OrganizationContext } from "@/store/use-auth-store";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import { deriveOrgState, hasAnyOrganization, type OrgState } from "@/lib/org-state";
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

type SwitchOrganizationResponse = AuthEnvelope & {
  sessionToken?: string;
  organization?: OrganizationContext | null;
  membership?: { id: string; role: OrganizationRole; organizationId: string } | null;
};

type UseOrgResponse = AuthEnvelope & {
  sessionToken?: string;
  organization?: OrganizationContext | null;
};

export type UseAuthResult = {
  user: User | null;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True pokud má uživatel alespoň jednu organizaci (membership). Zdroj: /auth/me. */
  hasOrganization: boolean;
  /** Stav organizace odvozený výhradně z /auth/me. */
  orgState: OrgState;
  authStatus:
    | "anonymous"
    | "authenticating"
    | "authenticated"
    | "refreshing"
    | "unauthenticated";
  isOffline: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  syncProfile: (options?: { force?: boolean }) => Promise<AuthEnvelope>;
  /** Switch active organization by membershipId. New JWT, no reload, clear org caches, navigate to dashboard. */
  switchOrganization: (membershipId: string) => Promise<void>;
  /** Switch active organization by orgId (e.g. after creating org). Calls POST /auth/use-org, updates token + profile. No redirect. */
  switchToOrganizationByOrgId: (orgId: string) => Promise<void>;
};


type AuthResponse = AuthEnvelope & {
  sessionToken?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];

export const useAuth = (): UseAuthResult => {
  const pathname = usePathname();
  const router = useRouter();
  const syncRef = useRef<Promise<AuthEnvelope> | null>(null);
  const refreshAttemptedRef = useRef(false);
  const {
    user,
    org,
    roles,
    permissions,
    loading,
    authStatus,
    offline,
    hydrated,
    hadSession,
    setProfile,
    setLoading,
    setAuthStatus,
    setOffline,
    setSessionToken,
    setHadSession,
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
    hadSession: state.hadSession,
    setProfile: state.setProfile,
    setLoading: state.setLoading,
    setAuthStatus: state.setAuthStatus,
    setOffline: state.setOffline,
    setSessionToken: state.setSessionToken,
    setHadSession: state.setHadSession,
    logout: state.logout,
  }));

  const isPublicRoute = useMemo(
    () => (pathname ? PUBLIC_ROUTES.includes(pathname) : false),
    [pathname],
  );

  const syncProfile = useCallback(
    async (options?: { force?: boolean }) => {
      if (syncRef.current) {
        return syncRef.current;
      }
      syncRef.current = (async () => {
        refreshAttemptedRef.current = false;
        setLoading(true);
        setAuthStatus("authenticating");
        if (AUTH_DEBUG) {
          console.log(
            "%c[AUTH][BOOT]",
            "color:#2563eb;font-weight:600",
            { pathname, hydrated, authStatus, loading, userId: user?.id ?? null },
          );
        }
        try {
          const profile = await fetchWithAuth<AuthEnvelope>("GET", "/auth/me", {
            retries: options?.force ? 0 : null,
            skipAuthRetry: true,
          });
          setProfile(profile);
          setAuthStatus("authenticated");
          return profile;
        } catch (error) {
          if (refreshAttemptedRef.current) {
            clearStore();
            setAuthStatus("unauthenticated");
            throw error;
          }
          refreshAttemptedRef.current = true;
          setAuthStatus("refreshing");
          try {
            await fetchWithAuth("POST", "/auth/refresh", {
              skipAuthRetry: true,
            });
            const profile = await fetchWithAuth<AuthEnvelope>("GET", "/auth/me", {
              retries: 0,
              skipAuthRetry: true,
            });
            setProfile(profile);
            setAuthStatus("authenticated");
            return profile;
          } catch (refreshError) {
            clearStore();
            setAuthStatus("unauthenticated");
            throw refreshError;
          }
        } finally {
          setLoading(false);
          syncRef.current = null;
          if (AUTH_DEBUG) {
            console.log(
              "%c[AUTH][READY]",
              "color:#0f766e;font-weight:600",
              { pathname, hydrated, authStatus: "authenticated", userId: user?.id ?? null },
            );
          }
        }
      })();
      return syncRef.current;
    },
    [
      setLoading,
      setProfile,
      setAuthStatus,
      clearStore,
      pathname,
      hydrated,
      authStatus,
      loading,
      user?.id,
    ],
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
    if (isPublicRoute) {
      setAuthStatus("anonymous");
      return;
    }
    if (!hadSession) {
      setAuthStatus("unauthenticated");
      return;
    }
    if (authStatus === "authenticated") return;
    if (authStatus === "authenticating" || authStatus === "refreshing") return;
    syncProfile().catch(() => {
      // Guard handles unauthenticated redirect after bootstrap.
    });
  }, [hydrated, loading, authStatus, syncProfile, isPublicRoute, hadSession, setAuthStatus]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const loginResult = await fetchWithAuth<AuthResponse | undefined>("POST", "/auth/login", {
          body: payload,
          skipAuthRetry: true,
        });
        const incomingToken = loginResult?.sessionToken;
        if (typeof incomingToken === "string" && incomingToken.length > 0) {
          setSessionToken(incomingToken);
        }
        if (loginResult) {
          setProfile(loginResult);
        }
        setHadSession(true);
        setAuthStatus("authenticated");
        audit({ action: "LOGIN" });
        showToastOnce("Přihlášení proběhlo úspěšně! 🎉", { type: "success" });
      } catch (error) {
        showToastOnce("Neplatné přihlašovací údaje ❌", { type: "error" });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setSessionToken, setProfile, setHadSession, setAuthStatus],
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
      setHadSession(false);
      setAuthStatus("unauthenticated");
    }
  }, [clearStore, org?.id, setSessionToken, setHadSession, setAuthStatus]);

  const switchOrganization = useCallback(
    async (membershipId: string) => {
      const previousOrgId = org?.id ?? null;
      setLoading(true);
      try {
        const res = await fetchWithAuth<SwitchOrganizationResponse>(
          "POST",
          "/auth/switch-organization",
          { body: { membershipId }, skipAuthRetry: true },
        );
        if (typeof res?.sessionToken === "string") {
          setSessionToken(res.sessionToken);
        }
        const nextOrg = res?.organization ?? res?.org ?? null;
        const nextUser = res?.user ?? null;
        const nextRoles = res?.roles ?? [];
        const nextPermissions = res?.permissions ?? [];
        setProfile({
          user: nextUser ?? null,
          org: nextOrg,
          roles: nextRoles,
          permissions: nextPermissions,
        });
        if (previousOrgId) {
          useAcademicYearStore.getState().clearOrg(previousOrgId);
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem("skillstorm_activeMembershipId", membershipId);
          window.localStorage.setItem("skillstorm_activeMembershipSwitchedAt", String(Date.now()));
        }
        router.replace("/dashboard");
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
    [org?.id, setLoading, setSessionToken, setProfile, router],
  );

  const switchToOrganizationByOrgId = useCallback(
    async (orgId: string) => {
      const previousOrgId = org?.id ?? null;
      setLoading(true);
      try {
        const res = await fetchWithAuth<UseOrgResponse>("POST", "/auth/use-org", {
          body: { orgId },
          skipAuthRetry: true,
        });
        if (typeof res?.sessionToken === "string") {
          setSessionToken(res.sessionToken);
        }
        const nextOrg = res?.organization ?? res?.org ?? null;
        setProfile({
          user: res?.user ?? user,
          org: nextOrg,
          roles: res?.roles ?? [],
          permissions: res?.permissions ?? [],
        });
        if (previousOrgId) {
          useAcademicYearStore.getState().clearOrg(previousOrgId);
        }
      } finally {
        setLoading(false);
      }
    },
    [org?.id, user, setLoading, setSessionToken, setProfile],
  );

  const hasOrganization = hasAnyOrganization({
    memberships: user?.memberships,
    organization: org,
  });

  const orgState = useMemo(
    () =>
      deriveOrgState({
        memberships: user?.memberships,
        organization: org,
      }),
    [user?.memberships, org],
  );

  const value = useMemo(
    () => ({
      user,
      org,
      roles,
      permissions,
      isLoading:
        loading ||
        !hydrated ||
        authStatus === "authenticating" ||
        authStatus === "refreshing",
      isAuthenticated: authStatus === "authenticated",
      hasOrganization,
      orgState,
      authStatus,
      isOffline: offline,
      login,
      logout,
      syncProfile,
      switchOrganization,
      switchToOrganizationByOrgId,
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
      orgState,
      login,
      logout,
      syncProfile,
      switchOrganization,
      switchToOrganizationByOrgId,
    ],
  );

  return value;
};
