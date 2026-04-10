"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuthStore, type OrganizationContext, type AuthPhase } from "@/store/use-auth-store";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import { useCurrentAcademicYearState } from "@/store/use-current-academic-year-state";
import { deriveOrgState, type OrgState } from "@/lib/org-state";
import {
  clearClientSessionArtifacts,
  clearLogoutNavigationInProgress,
  markLogoutNavigationInProgress,
} from "@/lib/auth-session";
import type { OrganizationRole, PermissionKey, User, AuthContext } from "@/types";
import { showToastOnce } from "@/utils/toast";
import { AUTH_DEBUG, API_BASE_PATH } from "@/utils/env";
import { audit } from "@/lib/audit/audit.client";

type AuthEnvelope = {
  user: User;
  org?: OrganizationContext | null;
  organization?: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  context: AuthContext;
};

type SwitchOrganizationResponse = AuthEnvelope & {
  organization?: OrganizationContext | null;
  membership?: { id: string; role: OrganizationRole; organizationId: string } | null;
};

type UseOrgResponse = AuthEnvelope & {
  organization?: OrganizationContext | null;
};

export type UseAuthResult = {
  user: User | null;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  context: AuthContext | null;
  isHydrated: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  authPhase: AuthPhase;
  isLoggingOut: boolean;
  hasOrganization: boolean;
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
  switchOrganization: (membershipId: string) => Promise<void>;
  switchToOrganizationByOrgId: (orgId: string) => Promise<AuthContext | null>;
};

type AuthResponse = AuthEnvelope;

export type LoginPayload = {
  email: string;
  password: string;
};

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];
const isPublicRoutePath = (path: string) =>
  PUBLIC_ROUTES.includes(path) || path.startsWith("/reset-password/");

/**
 * Hlavní klientský auth hook.
 *
 * Zodpovídá za:
 * - bootstrap session po načtení aplikace,
 * - synchronizaci profilu přes `/auth/me`,
 * - obnovu session přes refresh token,
 * - logout a přepínání aktivní organizace,
 * - odvození auth stavu pro guardy a layouty.
 *
 * Hook schválně drží auth logiku na jednom místě, aby zbytek UI
 * pracoval už jen s jednotným auth stavem a nemusel řešit refresh flow.
 */
export const useAuth = (): UseAuthResult => {
  const pathname = usePathname();
  const router = useRouter();
  const syncRef = useRef<Promise<AuthEnvelope> | null>(null);
  const refreshAttemptedRef = useRef(false);
  const sessionRecoveryAttemptedRef = useRef(false);
  const {
    authPhase,
    user,
    org,
    roles,
    permissions,
    context,
    loading,
    authStatus,
    offline,
    hydrated,
    hadSession,
    setProfile,
    setLoading,
    setAuthStatus,
    setOffline,
    setHadSession,
    setHydrated,
    beginLogout,
    clearAuthState,
  } = useAuthStore((state) => ({
    authPhase: state.authPhase,
    user: state.user,
    org: state.org,
    roles: state.roles,
    permissions: state.permissions,
    context: state.context,
    loading: state.loading,
    authStatus: state.authStatus,
    offline: state.offline,
    hydrated: state.hydrated,
    hadSession: state.hadSession,
    setProfile: state.setProfile,
    setLoading: state.setLoading,
    setAuthStatus: state.setAuthStatus,
    setOffline: state.setOffline,
    setHadSession: state.setHadSession,
    setHydrated: state.setHydrated,
    beginLogout: state.beginLogout,
    clearAuthState: state.clearAuthState,
  }));

  const isLoggingOut = authPhase === "LOGGING_OUT";

  const isPublicRoute = useMemo(
    () => (pathname ? isPublicRoutePath(pathname) : false),
    [pathname],
  );

  const syncProfile = useCallback(
    async (options?: { force?: boolean }) => {
      if (syncRef.current && !options?.force) {
        return syncRef.current;
      }
      if (options?.force) {
        syncRef.current = null;
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
        const meConfig = {
          retries: options?.force ? 0 : null,
          skipAuthRetry: true,
          ...(options?.force
            ? {
                cache: "no-store" as RequestCache,
                headers: {
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                  Pragma: "no-cache",
                },
              }
            : {}),
        };
        try {
          const profile = await fetchWithAuth<AuthEnvelope>("GET", "/auth/me", meConfig);
          setProfile(profile);
          setHadSession(true);
          setAuthStatus("authenticated");
          return profile;
        } catch (error) {
          if (refreshAttemptedRef.current) {
            clearAuthState();
            setAuthStatus("unauthenticated");
            throw error;
          }
          refreshAttemptedRef.current = true;
          setAuthStatus("refreshing");
          try {
            await fetchWithAuth("POST", "/auth/refresh", {
              skipAuthRetry: true,
            });
            const profile = await fetchWithAuth<AuthEnvelope>("GET", "/auth/me", meConfig);
            setProfile(profile);
            setHadSession(true);
            setAuthStatus("authenticated");
            return profile;
          } catch (refreshError) {
            clearAuthState();
            setAuthStatus("unauthenticated");
            throw refreshError;
          }
        } finally {
          setLoading(false);
          setHydrated(true);
          syncRef.current = null;
          if (AUTH_DEBUG) {
            console.log(
              "%c[AUTH][READY]",
              "color:#0f766e;font-weight:600",
              { pathname, hydrated: true, authStatus: "authenticated", userId: user?.id ?? null },
            );
          }
        }
      })();
      return syncRef.current;
    },
    [
      setLoading,
      setProfile,
      setHadSession,
      setAuthStatus,
      setHydrated,
      clearAuthState,
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
    if (typeof window === "undefined") return;
    if (isLoggingOut) return;
    if (loading) return;
    if (isPublicRoute) {
      // Public routes must not demote an already authenticated session.
      // Otherwise login/register can race with PostAuthResolver and bounce
      // platform users back to /login during the redirect.
      if (authStatus === "authenticated" || user) {
        setHydrated(true);
        return;
      }
      if (!hadSession) {
        setAuthStatus("anonymous");
        setHydrated(true);
        return;
      }
      if (authStatus === "authenticating" || authStatus === "refreshing") {
        return;
      }
      setHydrated(false);
      syncProfile().catch(() => {
        setAuthStatus("anonymous");
        setHydrated(true);
      });
      return;
    }
    if (!hadSession) {
      if (sessionRecoveryAttemptedRef.current) {
        setAuthStatus("unauthenticated");
        setHydrated(true);
        return;
      }
      sessionRecoveryAttemptedRef.current = true;
      setHydrated(false);
      syncProfile({ force: true }).catch(() => {
        setAuthStatus("unauthenticated");
        setHydrated(true);
      });
      return;
    }
    if (authStatus === "authenticated") return;
    if (authStatus === "authenticating" || authStatus === "refreshing") return;
    setHydrated(false);
    syncProfile().catch(() => {
      // Guard handles unauthenticated redirect after bootstrap.
    });
  }, [loading, authStatus, syncProfile, isPublicRoute, hadSession, setAuthStatus, setHydrated, isLoggingOut]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const loginResult = await fetchWithAuth<AuthResponse | undefined>("POST", "/auth/login", {
          body: payload,
          skipAuthRetry: true,
        });
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
    [setLoading, setProfile, setHadSession, setAuthStatus],
  );

  const logout = useCallback(async () => {
    beginLogout();
    markLogoutNavigationInProgress();
    const logoutRequest = fetch(`${API_BASE_PATH}/auth/logout`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);

    clearClientSessionArtifacts();
    useAcademicYearStore.getState().clearAll();
    router.replace("/login");
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (window.location.pathname.startsWith("/app")) {
          window.location.replace("/login");
        }
      }, 0);
    }

    try {
      await logoutRequest;
    } catch {
      // Logout must still clear local session state even if the network call fails.
    } finally {
      clearAuthState();
      clearLogoutNavigationInProgress();
    }
  }, [beginLogout, clearAuthState, router]);

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
        const nextOrg = res?.organization ?? res?.org ?? null;
        const nextUser = res?.user ?? null;
        const nextRoles = res?.roles ?? [];
        const nextPermissions = res?.permissions ?? [];
        setProfile({
          user: nextUser ?? null,
          org: nextOrg,
          roles: nextRoles,
          permissions: nextPermissions,
          context: res?.context ?? null,
        });
        if (previousOrgId) {
          useAcademicYearStore.getState().clearOrg(previousOrgId);
          useCurrentAcademicYearState.getState().resetOrg(previousOrgId);
        }
        const nextOrgId = res?.organization?.id ?? res?.org?.id ?? null;
        if (nextOrgId) {
          useCurrentAcademicYearState.getState().resetOrg(nextOrgId);
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem("skillstorm_activeMembershipId", membershipId);
          window.localStorage.setItem("skillstorm_activeMembershipSwitchedAt", String(Date.now()));
        }
        router.replace("/app");
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
    [org?.id, setLoading, setProfile, router],
  );

  const switchToOrganizationByOrgId = useCallback(
    async (orgId: string): Promise<AuthContext | null> => {
      const previousOrgId = org?.id ?? null;
      setLoading(true);
      try {
        const res = await fetchWithAuth<UseOrgResponse>("POST", "/auth/use-org", {
          body: { orgId },
          skipAuthRetry: true,
        });
        if (AUTH_DEBUG || process.env.NODE_ENV === "development") {
          console.log("[useAuth] use-org response", {
            hasContext: !!res?.context,
            mode: res?.context?.mode,
            hasOrg: !!(res?.organization ?? res?.org),
            hasUser: !!res?.user,
            membershipsCount: res?.user?.memberships?.length ?? 0,
          });
        }
        if (!res?.context || res.context.mode !== "organization") {
          throw new Error("USE_ORG_FAILED_OR_BAD_CONTEXT");
        }
        const effectiveContext = res.context;
        const nextOrg = res?.organization ?? res?.org ?? null;
        if (res.user != null) {
          setProfile({
            user: res.user,
            org: nextOrg,
            roles: res?.roles ?? [],
            permissions: res?.permissions ?? [],
            context: effectiveContext,
          });
        } else {
          const profile = await fetchWithAuth<AuthEnvelope>("GET", "/auth/me", {
            retries: 0,
            skipAuthRetry: true,
          });
          setProfile(profile);
        }
        if (previousOrgId) {
          useAcademicYearStore.getState().clearOrg(previousOrgId);
          useCurrentAcademicYearState.getState().resetOrg(previousOrgId);
        }
        if (orgId) {
          useCurrentAcademicYearState.getState().resetOrg(orgId);
        }
        return effectiveContext;
      } finally {
        setLoading(false);
      }
    },
    [org?.id, setLoading, setProfile],
  );

  const hasOrganization = context?.mode === "organization";

  const orgState = useMemo(
    () => {
      if (context?.mode === "platform") {
        return "HAS_ORG" as OrgState;
      }
      return deriveOrgState({
        memberships: user?.memberships,
        organization: org,
      });
    },
    [context?.mode, user?.memberships, org],
  );

  const value = useMemo(
    () => ({
      user,
      org,
      roles,
      permissions,
      context,
      authPhase,
      isLoggingOut,
      isHydrated: hydrated,
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
      context,
      authPhase,
      isLoggingOut,
      hydrated,
      loading,
      authStatus,
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
