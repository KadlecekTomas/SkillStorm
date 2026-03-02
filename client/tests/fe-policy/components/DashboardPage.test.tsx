/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import { recordPolicyCheck } from "../fePolicyScore";

vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

const mockState = {
  mode: "organization" as "organization" | "personal",
  permissions: [] as string[],
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    context: { mode: mockState.mode },
  }),
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    permissions: mockState.permissions,
    can: (permission: string) => mockState.permissions.includes(permission),
    hasRole: (role: "STUDENT" | "TEACHER" | "DIRECTOR" | "OWNER" | "SUPERADMIN") => {
      if (role === "STUDENT") return mockState.permissions.includes("VIEW_OWN_RESULTS");
      if (role === "TEACHER") return mockState.permissions.includes("CREATE_TEST");
      if (role === "DIRECTOR" || role === "OWNER") {
        return mockState.permissions.includes("MANAGE_TEACHERS");
      }
      return false;
    },
    isSuperAdmin: false,
  }),
}));

vi.mock("@/lib/guard/withGuard", () => ({
  withGuard: () => (Component: React.ComponentType) => Component,
}));

vi.mock("@/app/(dashboard)/dashboard/components/StudentDashboard", () => ({
  StudentDashboard: () => <div>student-dashboard</div>,
}));
vi.mock("@/app/(dashboard)/dashboard/components/TeacherDashboard", () => ({
  TeacherDashboard: () => <div>teacher-dashboard</div>,
}));
vi.mock("@/app/(dashboard)/dashboard/components/DirectorDashboard", () => ({
  DirectorDashboard: () => <div>director-dashboard</div>,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.mode = "organization";
    mockState.permissions = [];
  });

  it("renders student dashboard when student permissions are present", () => {
    mockState.permissions = ["VIEW_OWN_RESULTS"];
    render(<DashboardPage />);

    expect(screen.getByText("student-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("teacher-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("director-dashboard")).not.toBeInTheDocument();
    recordPolicyCheck("RBAC", "dashboard-student-surface", true, "Student view is driven by backend permissions.");
  });

  it("renders teacher dashboard when teacher permissions are present", () => {
    mockState.permissions = ["CREATE_TEST"];
    render(<DashboardPage />);

    expect(screen.getByText("teacher-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("student-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("director-dashboard")).not.toBeInTheDocument();
    recordPolicyCheck("RBAC", "dashboard-teacher-surface", true, "Teacher view is driven by backend permissions.");
  });

  it("renders director dashboard when management permissions are present", () => {
    mockState.permissions = ["MANAGE_TEACHERS"];
    render(<DashboardPage />);

    expect(screen.getByText("director-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("student-dashboard")).not.toBeInTheDocument();
    recordPolicyCheck("RBAC", "dashboard-director-surface", true, "Director view is driven by backend permissions.");
  });

  it("renders fallback when no permission-backed dashboard is available", () => {
    render(<DashboardPage />);

    expect(screen.getByText(/přehled není k dispozici/i)).toBeInTheDocument();
    recordPolicyCheck("RBAC", "dashboard-fallback", true, "Dashboard fallback renders when no role surface is allowed.");
  });
});
