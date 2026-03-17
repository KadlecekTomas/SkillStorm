"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  User,
  PermissionKey,
  OrganizationRole,
  OrganizationType,
  OrganizationStatus,
  AuthContext,
} from "@/types";
import { derivePermissions } from "@/utils/permissions";

export type OrgReadiness = "READY" | "NOT_READY";

/** Auth invariant: logout is a hard boundary. No protected component may render after logout. */
export type AuthPhase = "BOOTSTRAP" | "AUTHENTICATED" | "UNAUTHENTICATED" | "LOGGING_OUT";

export type OrgBootstrap = {
  hasAcademicYear: boolean;
  hasClassrooms: boolean;
  /** Current academic year has at least one class. Prefer this; accept deprecated alias. */
  hasClassroomsInCurrentYear?: boolean;
  hasClassroomsInActiveYear?: boolean;
};

export type OrganizationContext = {
  id: string;
  name: string;
  type: OrganizationType;
  status?: OrganizationStatus | null;
  /** From backend: READY only when org has current academic year + at least one class. */
  readiness?: OrgReadiness | null;
  /** From backend: drives setup vs dashboard. No /academic-years, /analytics, /audit until hasAcademicYear. */
  bootstrap?: OrgBootstrap | null;
  slug?: string | null;
};

export type AuthState = {
  authPhase: AuthPhase;
  user: User | null;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  context: AuthContext | null;
  loading: boolean;
  authStatus:
    | "anonymous"
    | "authenticating"
    | "authenticated"
    | "refreshing"
    | "unauthenticated";
  offline: boolean;
  hadSession: boolean;
  hydrated: boolean;
  setProfile: (payload: {
    user: User | null;
    org?: OrganizationContext | null;
    /** API /auth/me returns "organization"; mapped to org when org not provided. */
    organization?: OrganizationContext | null;
    roles?: OrganizationRole[];
    permissions?: PermissionKey[];
    context?: AuthContext | null;
  }) => void;
  setOrg: (org: OrganizationContext | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthStatus: (status: AuthState["authStatus"]) => void;
  setOffline: (offline: boolean) => void;
  setHadSession: (hadSession: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  beginLogout: () => void;
  clearAuthState: () => void;
};

const deriveRoles = (user: User | null): OrganizationRole[] => {
  if (!user) return [];
  const memberships = user.memberships ?? [];
  const roleFromMemberships = memberships.map((membership) => membership.role);
  const roleFromUser = user.organizationRole ? [user.organizationRole] : [];
  const unique = new Set<OrganizationRole>([
    ...roleFromMemberships,
    ...roleFromUser,
  ]);
  return Array.from(unique);
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authPhase: "BOOTSTRAP" as AuthPhase,
      user: null,
      org: null,
      roles: [],
      loading: false,
      authStatus: "anonymous",
      offline: false,
      permissions: [],
      hadSession: false,
      hydrated: false,
      context: null,
      setProfile: ({ user, org, organization, roles, permissions, context }) => {
        const resolvedOrg = org ?? organization ?? null;
        return set(() => ({
          user,
          org:
            resolvedOrg ??
            (user?.organizationId
              ? (() => {
                  const m = user.memberships?.find(
                    (membership) => membership.organizationId === user.organizationId,
                  )?.organization;
                  return {
                    id: user.organizationId,
                    name: m?.name ?? "Aktivní organizace",
                    type: (m?.type as OrganizationType | undefined) ?? "SCHOOL",
                    status: m?.status ?? null,
                  };
                })()
              : null),
          roles: roles ?? deriveRoles(user),
          permissions: permissions ?? derivePermissions(user),
          context: context ?? null,
        }));
      },
      setOrg: (org) => set(() => ({ org })),
      setLoading: (loading) => set(() => ({ loading })),
      setAuthStatus: (authStatus) =>
        set((s) => ({
          authStatus,
          authPhase:
            authStatus === "authenticated"
              ? ("AUTHENTICATED" as AuthPhase)
              : authStatus === "unauthenticated"
                ? ("UNAUTHENTICATED" as AuthPhase)
                : s.authPhase,
        })),
      setOffline: (offline) => set(() => ({ offline })),
      setHadSession: (hadSession) => set(() => ({ hadSession })),
      setHydrated: (hydrated) => set(() => ({ hydrated })),
      beginLogout: () =>
        set(() => ({
          authPhase: "LOGGING_OUT" as AuthPhase,
          loading: false,
        })),
      clearAuthState: () =>
        set(() => ({
          authPhase: "UNAUTHENTICATED" as AuthPhase,
          user: null,
          org: null,
          context: null,
          permissions: [],
          roles: [],
          loading: false,
          authStatus: "unauthenticated",
          hadSession: false,
          hydrated: true,
        })),
    }),
    {
      name: "skillstorm_auth",
      partialize: ({ user, permissions, roles, org, hadSession, context }) => ({
        user,
        permissions,
        roles,
        org,
        hadSession,
        context,
      }),
      // Do NOT set hydrated or authStatus here. Hydrated is set only after
      // auth bootstrap completes (syncProfile or !hadSession) in useAuth.
      onRehydrateStorage: () => () => {},
    },
  ),
);
