/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NoOrganizationScreen } from "@/components/onboarding/NoOrganizationScreen";
import { recordPolicyCheck } from "../fePolicyScore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    syncProfile: vi.fn(),
  }),
}));

vi.mock("@/lib/http/client", () => ({
  httpClient: {
    post: vi.fn(),
  },
}));

vi.mock("../fePolicyScore", () => ({
  recordPolicyCheck: vi.fn(),
}));

describe("NoOrganizationScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("does not auto-open join modal from deprecated join intent", async () => {
    sessionStorage.setItem(
      "join_intent",
      JSON.stringify({ joinCode: "JOIN-CODE-1", role: "TEACHER" }),
    );

    render(<NoOrganizationScreen />);

    await waitFor(() => {
      expect(
        screen.queryByText(/připojit se k organizaci/i),
      ).not.toBeInTheDocument();
    });

    recordPolicyCheck(
      "Onboarding",
      "join-modal-intent-ignored",
      true,
      "Deprecated join intent no longer auto-opens the modal.",
    );
  });
});
