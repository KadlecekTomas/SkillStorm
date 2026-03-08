/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthForm } from "@/components/forms/auth-form";
import { httpClient } from "@/lib/http/client";
import { recordPolicyCheck } from "../fePolicyScore";

const syncProfileMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    syncProfile: syncProfileMock,
    isLoading: false,
  }),
}));

vi.mock("@/lib/http/client", () => ({
  httpClient: {
    post: vi.fn(),
  },
  HttpError: class HttpError extends Error {
    status = 400;
    data = {};
    constructor(message: string) {
      super(message);
      this.name = "HttpError";
    }
  },
}));

vi.mock("@/store/use-auth-store", () => ({
  useAuthStore: {
    getState: () => ({}),
  },
}));

vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

describe("AuthForm (register)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("submits JOIN_ORG mode with invite token", async () => {
    vi.mocked(httpClient.post).mockResolvedValue({ user: { id: "user-1" } });

    render(
      <AuthForm
        mode="register"
        initialMode="JOIN_ORG"
        initialJoinCode="JOIN-123"
      />,
    );

    fireEvent.change(screen.getByLabelText(/jméno/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/heslo/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /vytvořit účet/i }));

    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalled();
    });

    expect(httpClient.post).toHaveBeenCalledWith(
      "/auth/register",
      expect.objectContaining({
        mode: "JOIN_ORG",
        email: "test@example.com",
        inviteToken: "JOIN-123",
      }),
    );

    expect(sessionStorage.getItem("join_intent")).toBeNull();

    recordPolicyCheck(
      "Auth",
      "register-join-invite-token",
      true,
      "Invite token is sent with JOIN_ORG registration.",
    );
  });
});
