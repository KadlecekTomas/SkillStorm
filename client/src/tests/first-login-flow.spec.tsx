/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirstLoginGate } from "@/components/auth/FirstLoginGate";
import ChangePasswordPage from "@/app/(auth)/change-password/page";

const mocks = vi.hoisted(() => ({
  pathname: "/app",
  replace: vi.fn(),
  fetchWithAuth: vi.fn(),
  syncProfile: vi.fn(),
  auth: {
    isAuthenticated: true,
    isLoading: false,
    user: { id: "student-1", name: "Student", mustChangePassword: true },
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ ...mocks.auth, syncProfile: mocks.syncProfile }),
}));

vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: mocks.fetchWithAuth,
}));

vi.mock("@/utils/toast", () => ({ showToastOnce: vi.fn() }));

describe("first-login frontend flow", () => {
  beforeEach(() => {
    mocks.pathname = "/app";
    mocks.replace.mockReset();
    mocks.fetchWithAuth.mockReset();
    mocks.syncProfile.mockReset();
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    mocks.auth.user = {
      id: "student-1",
      name: "Student",
      mustChangePassword: true,
    };
  });

  it("blocks protected content and redirects a marked account", async () => {
    render(
      <FirstLoginGate>
        <div>Private dashboard</div>
      </FirstLoginGate>,
    );

    expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
    expect(
      screen.getByText("Připravuji bezpečnou změnu hesla…"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/change-password"),
    );
  });

  it("allows the dedicated password-change route to render", () => {
    mocks.pathname = "/change-password";
    render(
      <FirstLoginGate>
        <div>Password lifecycle</div>
      </FirstLoginGate>,
    );
    expect(screen.getByText("Password lifecycle")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("does not restrict an unaffected account", () => {
    mocks.auth.user.mustChangePassword = false;
    render(
      <FirstLoginGate>
        <div>Private dashboard</div>
      </FirstLoginGate>,
    );
    expect(screen.getByText("Private dashboard")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("validates confirmation before calling the password endpoint", async () => {
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText("Dočasné heslo"), {
      target: { value: "Temporary987!" },
    });
    fireEvent.change(screen.getByLabelText("Nové heslo"), {
      target: { value: "Secure987!" },
    });
    fireEvent.change(screen.getByLabelText("Potvrzení nového hesla"), {
      target: { value: "Different987!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Změnit heslo a pokračovat" }),
    );

    expect(await screen.findByText("Nová hesla se neshodují.")).toBeInTheDocument();
    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
  });

  it("changes the password, refreshes the server profile, and continues", async () => {
    mocks.fetchWithAuth.mockResolvedValueOnce({});
    mocks.syncProfile.mockResolvedValueOnce({});
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText("Dočasné heslo"), {
      target: { value: "Temporary987!" },
    });
    fireEvent.change(screen.getByLabelText("Nové heslo"), {
      target: { value: "Secure987!" },
    });
    fireEvent.change(screen.getByLabelText("Potvrzení nového hesla"), {
      target: { value: "Secure987!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Změnit heslo a pokračovat" }),
    );

    await waitFor(() =>
      expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
        "POST",
        "/auth/change-password",
        {
          body: {
            currentPassword: "Temporary987!",
            newPassword: "Secure987!",
          },
          skipAuthRetry: true,
        },
      ),
    );
    expect(mocks.syncProfile).toHaveBeenCalledWith({ force: true });
    expect(mocks.replace).toHaveBeenCalledWith("/app");
  });
});
