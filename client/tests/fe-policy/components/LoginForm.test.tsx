/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/forms/login-form";
import { recordPolicyCheck } from "../fePolicyScore";

const loginMock = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    login: loginMock,
    isLoading: false,
  }),
}));

describe("LoginForm", () => {
  it("validates inputs before submitting", async () => {
    render(<LoginForm />);
    const submitButton = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(submitButton);
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    recordPolicyCheck("Auth", "login-form-validation", true, "Login form blocks empty submission.");
  });

  it("calls login with form values", async () => {
    loginMock.mockResolvedValueOnce(undefined);
    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@school\.edu/i), {
      target: { value: "teacher@atlas.test" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        login: "teacher@atlas.test",
        password: "password",
      });
    });
    recordPolicyCheck("Auth", "login-form-submit", true, "Login form triggers hook with credentials.");
  });
});
