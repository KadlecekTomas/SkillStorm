/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import { PermissionKey } from "@/types";
import { recordPolicyCheck } from "../fePolicyScore";

const useAuthMock = vi.fn();

vi.mock("@/lib/guard/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/utils/rbac-telemetry", () => ({
  reportForbiddenAccess: vi.fn(),
}));

describe("GuardBoundary", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("renders children when permissions satisfy guard", () => {
    useAuthMock.mockReturnValue({
      user: { id: "user", organizationRole: "TEACHER" },
      org: { id: "org-a", name: "Atlas" },
      roles: ["TEACHER"],
      permissions: [PermissionKey.VIEW_RESULTS],
      isLoading: false,
      isAuthenticated: true,
      isOffline: false,
      login: vi.fn(),
      logout: vi.fn(),
      syncProfile: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(
      <GuardBoundary requirePerms={[PermissionKey.VIEW_RESULTS]}>
        <div>guarded content</div>
      </GuardBoundary>,
    );

    expect(screen.getByText("guarded content")).toBeInTheDocument();
    recordPolicyCheck("RBAC", "guard-allows-view-results", true, "Teacher with VIEW_RESULTS can access module.");
  });

  it("shows AccessDenied when requirements fail", () => {
    useAuthMock.mockReturnValue({
      user: { id: "user", organizationRole: "STUDENT" },
      org: { id: "org-a", name: "Atlas" },
      roles: ["STUDENT"],
      permissions: [],
      isLoading: false,
      isAuthenticated: true,
      isOffline: false,
      login: vi.fn(),
      logout: vi.fn(),
      syncProfile: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(
      <GuardBoundary requirePerms={[PermissionKey.MANAGE_TEACHERS]}>
        <div>blocked</div>
      </GuardBoundary>,
    );

    expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
    recordPolicyCheck("RBAC", "guard-denies-manage-teachers", true, "Student without MANAGE_TEACHERS is blocked.");
  });
});
