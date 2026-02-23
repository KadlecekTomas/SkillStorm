/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import RegisterPage from "@/app/(auth)/register/page";
import { recordPolicyCheck } from "../fePolicyScore";

const replaceMock = vi.fn();
let authState: any = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/components/forms/auth-form", () => ({
  AuthForm: () => <div>AuthForm</div>,
}));

vi.mock("@/utils/permissions", () => ({
  getRoleHomePath: () => "/dashboard",
}));

vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

describe("RegisterPage redirects", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    sessionStorage.clear();
  });

  it("does not redirect while auth is booting", async () => {
    authState = {
      user: { id: "user-1" },
      isLoading: true,
      authStatus: "booting",
    };

    render(<RegisterPage />);

    await waitFor(() => {
      expect(replaceMock).not.toHaveBeenCalled();
    });

    recordPolicyCheck(
      "Auth",
      "register-no-redirect-booting",
      true,
      "Register page avoids redirects during auth bootstrap.",
    );
  });

  it("does not redirect based on deprecated join intent", async () => {
    sessionStorage.setItem(
      "join_intent",
      JSON.stringify({ joinCode: "JOIN-123" }),
    );
    authState = {
      user: { id: "user-2" },
      isLoading: false,
      authStatus: "ready",
    };

    render(<RegisterPage />);

    await waitFor(() => {
      expect(replaceMock).not.toHaveBeenCalled();
    });

    recordPolicyCheck(
      "Auth",
      "register-join-intent-ignored",
      true,
      "Deprecated join intent does not trigger redirects.",
    );
  });
});
