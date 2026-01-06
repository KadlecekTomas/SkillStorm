"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  User,
  PermissionKey,
  OrganizationRole,
} from "@/types";
import { derivePermissions } from "@/utils/permissions";

export type OrganizationContext = {
  id: string;
  name: string;
  slug?: string | null;
};

export type AuthState = {
  user: User | null;
  org: OrganizationContext | null;
  roles: OrganizationRole[];
  permissions: PermissionKey[];
  loading: boolean;
  offline: boolean;
  sessionToken: string | null;
  hydrated: boolean;
  setProfile: (payload: {
    user: User | null;
    org?: OrganizationContext | null;
    roles?: OrganizationRole[];
    permissions?: PermissionKey[];
  }) => void;
  setOrg: (org: OrganizationContext | null) => void;
  setLoading: (loading: boolean) => void;
  setOffline: (offline: boolean) => void;
  setSessionToken: (token: string | null) => void;
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
      offline: false,
      permissions: [],
      sessionToken: null,
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
                }
              : null),
          roles: roles ?? deriveRoles(user),
          permissions: permissions ?? derivePermissions(user),
        })),
      setOrg: (org) => set(() => ({ org })),
      setLoading: (loading) => set(() => ({ loading })),
      setOffline: (offline) => set(() => ({ offline })),
      setSessionToken: (sessionToken) => set(() => ({ sessionToken })),
      setHydrated: (hydrated) => set(() => ({ hydrated })),
      logout: () =>
        set(() => ({
          user: null,
          org: null,
          permissions: [],
          roles: [],
          loading: false,
          sessionToken: null,
        })),
    }),
    {
      name: "skillstorm_auth",
      partialize: ({ user, permissions, roles, org, sessionToken }) => ({
        user,
        permissions,
        roles,
        org,
        sessionToken,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          return;
        }
        state?.setHydrated(true);
      },
    },
  ),
);
