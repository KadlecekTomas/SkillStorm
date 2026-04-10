/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateOrganizationOnboardingScreen } from "@/components/onboarding/CreateOrganizationOnboardingScreen";

const replaceMock = vi.fn();
const postMock = vi.fn();
const syncProfileMock = vi.fn();
const switchToOrganizationByOrgIdMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    syncProfile: syncProfileMock,
    hasOrganization: false,
    switchToOrganizationByOrgId: switchToOrganizationByOrgIdMock,
  }),
}));

vi.mock("@/lib/http/client", () => ({
  createCorrelationId: () => "idem-test-key",
  HttpError: class HttpError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status = 500, data: unknown = undefined) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
  httpClient: {
    post: postMock,
  },
}));

vi.mock("@/utils/toast", () => ({
  showToastOnce: vi.fn(),
}));

describe("CreateOrganizationOnboardingScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recovers when organization create succeeds but switch-org fails", async () => {
    postMock.mockResolvedValue({ id: "org-1", type: "SCHOOL" });
    switchToOrganizationByOrgIdMock.mockRejectedValue(
      new Error("switch failed"),
    );
    syncProfileMock.mockResolvedValue({
      organization: { id: "org-1", type: "SCHOOL" },
      org: null,
      context: { mode: "organization" },
    });

    render(<CreateOrganizationOnboardingScreen />);

    fireEvent.change(screen.getByLabelText(/název organizace/i), {
      target: { value: "Recovery School" },
    });
    fireEvent.click(screen.getByRole("button", { name: /vytvořit organizaci/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/organizations",
        { name: "Recovery School", type: "SCHOOL" },
        expect.objectContaining({
          headers: expect.objectContaining({
            "Idempotency-Key": "idem-test-key",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(syncProfileMock).toHaveBeenCalledWith({ force: true });
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/onboarding/pending");
    });

    expect(
      screen.queryByText(/organizace byla vytvořena, ale nepodařilo se přepnout kontext/i),
    ).not.toBeInTheDocument();
  });
});
