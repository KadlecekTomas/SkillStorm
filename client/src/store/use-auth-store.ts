"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  User,
  PermissionKey,
  OrganizationRole,
  OrganizationType,
} from "@/types";
import { derivePermissions } from "@/utils/permissions";

export type OrganizationContext = {
  id: string;
  name: string;
  type: OrganizationType;
  slug?: string | null;
};

export type AuthState = {
  user: User | null;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  loading: boolean;
  authStatus:
    | "anonymous"
    | "authenticating"
    | "authenticated"
    | "refreshing"
    | "unauthenticated";
  offline: boolean;
  sessionToken: string | null;
  hadSession: boolean;
  hydrated: boolean;
  setProfile: (payload: {
    user: User | null;
    org?: OrganizationContext | null;
    roles?: OrganizationRole[];
    permissions?: PermissionKey[];
  }) => void;
  setOrg: (org: OrganizationContext | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthStatus: (status: AuthState["authStatus"]) => void;
  setOffline: (offline: boolean) => void;
  setSessionToken: (token: string | null) => void;
  setHadSession: (hadSession: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  logout: () => void;
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
      user: null,
      org: null,
      roles: [],
      loading: false,
      authStatus: "anonymous",
      offline: false,
      permissions: [],
      sessionToken: null,
      hadSession: false,
      hydrated: false,
      setProfile: ({ user, org, roles, permissions }) =>
        set(() => ({
          user,
          org:
            org ??
            (user?.organizationId
              ? {
                  id: user.organizationId,
                  name: user.memberships?.find(
                    (membership) => membership.organizationId === user.organizationId,
                  )?.organization?.name ?? "Aktivní organizace",
                  type:
                    (user.memberships?.find(
                      (membership) => membership.organizationId === user.organizationId,
                    )?.organization?.type as OrganizationType | undefined) ??
                    "SCHOOL",
                }
              : null),
          roles: roles ?? deriveRoles(user),
          permissions: permissions ?? derivePermissions(user),
        })),
      setOrg: (org) => set(() => ({ org })),
      setLoading: (loading) => set(() => ({ loading })),
      setAuthStatus: (authStatus) => set(() => ({ authStatus })),
      setOffline: (offline) => set(() => ({ offline })),
      setSessionToken: (sessionToken) => set(() => ({ sessionToken })),
      setHadSession: (hadSession) => set(() => ({ hadSession })),
      setHydrated: (hydrated) => set(() => ({ hydrated })),
      logout: () =>
        set(() => ({
          user: null,
          org: null,
          permissions: [],
          roles: [],
          loading: false,
          authStatus: "unauthenticated",
          sessionToken: null,
          hadSession: false,
        })),
    }),
    {
      name: "skillstorm_auth",
      partialize: ({ user, permissions, roles, org, sessionToken, hadSession }) => ({
        user,
        permissions,
        roles,
        org,
        sessionToken,
        hadSession,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          return;
        }
        state?.setHydrated(true);
        state?.setAuthStatus("authenticating");
      },
    },
  ),
);
