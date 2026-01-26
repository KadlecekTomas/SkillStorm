import { renderHook, act, waitFor } from "@testing-library/react";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/use-auth-store";
import type { AuthState } from "@/store/use-auth-store";
import { PermissionKey } from "@/types";

describe("usePermissions", () => {
  afterEach(() => {
    act(() => {
      useAuthStore.setState({
        user: null,
        sessionToken: null,
        loading: false,
        permissions: [],
      } satisfies Partial<AuthState>);
    });
  });

  it("returns helpers for role and permission checks", async () => {
    act(() => {
      useAuthStore.setState({
        user: {
          id: "student-1",
          name: "Test Student",
          organizationRole: "STUDENT",
          systemRole: null,
        },
        permissions: [PermissionKey.VIEW_RESULTS],
      } satisfies Partial<AuthState>);
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.can(PermissionKey.VIEW_RESULTS)).toBe(true);
    });

    expect(result.current.can(PermissionKey.CREATE_TEST)).toBe(false);
    expect(result.current.hasRole("STUDENT")).toBe(true);
  });

  it("detects superadmin roles via system role", async () => {
    act(() => {
      useAuthStore.setState({
        user: { id: "admin-1", name: "Test Admin", systemRole: "SUPERADMIN" },
        permissions: [],
      } satisfies Partial<AuthState>);
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isSuperAdmin).toBe(true);
    });

    expect(result.current.hasRole("SUPERADMIN")).toBe(true);
  });
});
