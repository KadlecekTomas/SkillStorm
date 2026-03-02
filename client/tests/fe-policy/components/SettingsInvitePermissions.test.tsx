/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/(app)/app/settings/page";
import { PermissionKey } from "@/types";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-1", name: "Demo School" },
    hasOrganization: true,
  }),
}));

const permissionsState: { can: (key: PermissionKey) => boolean } = {
  can: (key: PermissionKey) => key === PermissionKey.INVITE_STUDENTS,
};

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => permissionsState,
}));

vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: vi.fn().mockResolvedValue({
    inviteToken: "invite-token",
    code: "invite-token",
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("SettingsPage invite permissions", () => {
  beforeEach(() => {
    permissionsState.can = (key: PermissionKey) => key === PermissionKey.INVITE_STUDENTS;
  });

  it("renders invite section only when user has invite permission", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/invite members/i)).toBeInTheDocument();
  });

  it("hides invite section when user lacks invite permission", () => {
    permissionsState.can = (_key: PermissionKey) => false;
    render(<SettingsPage />);
    expect(screen.queryByText(/invite members/i)).not.toBeInTheDocument();
  });
});
