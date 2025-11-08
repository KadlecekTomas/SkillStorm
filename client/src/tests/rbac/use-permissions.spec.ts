import { renderHook, act } from "@testing-library/react";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/use-auth-store";
import type { AuthState } from "@/store/use-auth-store";
import { PermissionKey } from "@/types";

describe("usePermissions", () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      loading: false,
      permissions: [],
    } satisfies Partial<AuthState>);
  });

  it("returns helpers for role and permission checks", () => {
    act(() => {
      useAuthStore.setState({
        user: {
          id: "student-1",
          organizationRole: "STUDENT",
          systemRole: null,
        },
        permissions: [PermissionKey.VIEW_RESULTS],
      } satisfies Partial<AuthState>);
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.can(PermissionKey.VIEW_RESULTS)).toBe(true);
    expect(result.current.can(PermissionKey.CREATE_TEST)).toBe(false);
    expect(result.current.hasRole("STUDENT")).toBe(true);
  });

  it("detects superadmin roles via system role", () => {
    act(() => {
      useAuthStore.setState({
        user: { id: "admin-1", systemRole: "SUPERADMIN" },
        permissions: [],
      } satisfies Partial<AuthState>);
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.hasRole("SUPERADMIN")).toBe(true);
  });
});
