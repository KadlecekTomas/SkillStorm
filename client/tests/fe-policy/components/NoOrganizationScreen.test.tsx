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

  it("opens join modal when join intent is present", async () => {
    sessionStorage.setItem(
      "join_intent",
      JSON.stringify({ joinCode: "JOIN-CODE-1", role: "TEACHER" }),
    );

    render(<NoOrganizationScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(/připojit se k organizaci/i),
      ).toBeInTheDocument();
    });

    const joinCodeInput = screen.getByLabelText(/kód organizace/i);
    expect(joinCodeInput).toHaveValue("JOIN-CODE-1");

    recordPolicyCheck(
      "Onboarding",
      "join-modal-prefill",
      true,
      "Join modal opens from stored intent and pre-fills the code.",
    );
  });
});
