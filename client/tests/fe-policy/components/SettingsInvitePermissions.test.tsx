/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/(school)/app/settings/page";
import { PermissionKey } from "@/types";

const authState: {
  activeRole: "DIRECTOR" | "TEACHER";
} = {
  activeRole: "DIRECTOR",
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-1", name: "Demo School" },
    user: null,
    activeRole: authState.activeRole,
    syncProfile: vi.fn(),
  }),
}));

const permissionsState: { can: (key: PermissionKey) => boolean } = {
  can: (_key: PermissionKey) => false,
};

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => permissionsState,
}));

vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("SettingsPage people management entry", () => {
  beforeEach(() => {
    authState.activeRole = "DIRECTOR";
    permissionsState.can = (_key: PermissionKey) => false;
  });

  it("shows one clear people-management entry to school leadership", () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole("heading", { name: "Lidé ve škole" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Otevřít lidi ve škole" }),
    ).toHaveAttribute("href", "/app/people");
    expect(
      screen.queryByRole("heading", { name: "Pozvat členy" }),
    ).not.toBeInTheDocument();
  });

  it("does not expose the management entry to a teacher", () => {
    authState.activeRole = "TEACHER";
    render(<SettingsPage />);

    expect(
      screen.queryByRole("heading", { name: "Lidé ve škole" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pozvat členy" }),
    ).not.toBeInTheDocument();
  });
});
