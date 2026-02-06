"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/client";
import { useAuthStore, type OrganizationContext, type AuthPhase } from "@/store/use-auth-store";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import { deriveOrgState, type OrgState } from "@/lib/org-state";
import type { OrganizationRole, PermissionKey, User, AuthContext } from "@/types";
import { showToastOnce } from "@/utils/toast";
import { AUTH_DEBUG, API_BASE_PATH } from "@/utils/env";
import { audit } from "@/lib/audit/audit.client";

type AuthEnvelope = {
  user: User;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  context: AuthContext;
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
  context: AuthContext | null;
  /** True after auth bootstrap has completed (getMe, restore session, or decided unauthenticated). */
  isHydrated: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Auth invariant: logout is a hard boundary. No protected component may render after logout. */
  authPhase: AuthPhase;
  isLoggingOut: boolean;
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
  /** Switch active organization by orgId (e.g. after creating org). Calls POST /auth/use-org, updates token + profile. No redirect. Returns new context on success. */
  switchToOrganizationByOrgId: (orgId: string) => Promise<AuthContext | null>;
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
    setSessionToken,
    setHadSession,
    setHydrated,
    logout: clearStore,
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
    setSessionToken: state.setSessionToken,
    setHadSession: state.setHadSession,
    setHydrated: state.setHydrated,
    logout: state.logout,
  }));

  const isLoggingOut = authPhase === "LOGGING_OUT";

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
      setAuthStatus,
      setHydrated,
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
    if (typeof window === "undefined") return;
    if (isLoggingOut) return;
    if (loading) return;
    if (isPublicRoute) {
      setAuthStatus("anonymous");
      setHydrated(true);
      return;
    }
    if (!hadSession) {
      setAuthStatus("unauthenticated");
      setHydrated(true);
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

  // Auth invariant: logout is a hard boundary. No protected component may render after logout.
  const logout = useCallback(async () => {
    clearStore();
    if (typeof window !== "undefined") {
      fetch(`${API_BASE_PATH}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    }
    router.replace("/login");
  }, [clearStore, router]);

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
          context: res?.context ?? null,
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

  /**
   * Switch active organization by orgId (e.g. after create-org).
   * CONTRACT: POST /auth/use-org must return user (with memberships), organization, context.
   * - If res.user exists: setProfile uses ONLY res.user (no fallback to store).
   * - If res.user missing: GET /auth/me then setProfile from response.
   * - Returns context only when context.mode === "organization"; otherwise throws.
   */
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
        if (typeof res?.sessionToken === "string") {
          setSessionToken(res.sessionToken);
        }
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
        }
        return effectiveContext;
      } finally {
        setLoading(false);
      }
    },
    [org?.id, setLoading, setSessionToken, setProfile],
  );

  const hasOrganization = context?.mode === "organization";

  const orgState = useMemo(
    () => {
      if (context?.mode === "platform") {
        // Platform admins nejsou vázaní na konkrétní školu – z pohledu
        // readiness je platforma vždy „připravená“.
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
