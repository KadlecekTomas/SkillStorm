/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  replaceMock,
  syncProfileMock,
  clearOrgMock,
  clearAuthIntentMock,
  showToastOnceMock,
  searchParamsState,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  syncProfileMock: vi.fn(),
  clearOrgMock: vi.fn(),
  clearAuthIntentMock: vi.fn(),
  showToastOnceMock: vi.fn(),
  searchParamsState: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/join",
  useRouter: () => ({
    replace: (target: string) => {
      replaceMock(target);
      const query = target.split("?")[1] ?? "";
      searchParamsState.current = new URLSearchParams(query);
    },
  }),
  useSearchParams: () => searchParamsState.current,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    hasOrganization: false,
    isLoading: false,
    syncProfile: syncProfileMock,
  }),
}));

vi.mock("@/store/use-academic-year-store", () => ({
  useAcademicYearStore: (selector: (state: { clearOrg: typeof clearOrgMock }) => unknown) =>
    selector({ clearOrg: clearOrgMock }),
}));

vi.mock("@/lib/auth-intent", () => ({
  setAuthIntent: vi.fn(),
  clearAuthIntent: clearAuthIntentMock,
}));

vi.mock("@/utils/toast", () => ({
  showToastOnce: showToastOnceMock,
  resolveToastFromHttpError: (error: { message?: string }) => ({
    message: error.message ?? "Pozvánka je neplatná nebo vypršela.",
  }),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  LoadingSpinner: ({ label }: { label?: string }) => <div>{label ?? "Loading…"}</div>,
}));

vi.mock("@/lib/http/client", () => {
  class MockHttpError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status = 400, data: unknown = {}) {
      super(message);
      this.name = "HttpError";
      this.status = status;
      this.data = data;
    }
  }

  return {
    httpClient: {
      get: vi.fn(),
    },
    fetchWithAuth: vi.fn(),
    HttpError: MockHttpError,
  };
});

import JoinPage from "@/app/(auth)/join/page";
import { fetchWithAuth, httpClient } from "@/lib/http/client";

describe("JoinPage retry flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.current = new URLSearchParams();
  });

  it("shows invalid code error and resets to a fresh input state after retry", async () => {
    searchParamsState.current = new URLSearchParams("token=BAD-CODE");
    vi.mocked(httpClient.get).mockRejectedValueOnce(new Error("Pozvánka je neplatná nebo vypršela."));

    render(<JoinPage />);

    expect(await screen.findByText(/neplatná nebo vypršená pozvánka/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/kód nebo token pozvánky/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zkusit jiný kód/i }));

    const input = await screen.findByLabelText(/kód nebo token pozvánky/i);
    expect(screen.queryByText(/neplatná nebo vypršená pozvánka/i)).not.toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(replaceMock).toHaveBeenCalledWith("/join");
    expect(searchParamsState.current.get("token")).toBeNull();
  });

  it("allows a new valid code to be submitted after a failed attempt", async () => {
    searchParamsState.current = new URLSearchParams("token=BAD-CODE");
    vi.mocked(httpClient.get)
      .mockRejectedValueOnce(new Error("Pozvánka je neplatná nebo vypršela."))
      .mockResolvedValueOnce({
        type: "ORG_ONLY",
        organizationId: "org-1",
        organizationName: "SkillStorm School",
        role: "TEACHER",
      });
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      organization: { id: "org-1" },
    });

    render(<JoinPage />);

    expect(await screen.findByText(/neplatná nebo vypršená pozvánka/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /zkusit jiný kód/i }));

    const input = await screen.findByLabelText(/kód nebo token pozvánky/i);
    await userEvent.type(input, "VALID-123");
    await userEvent.click(screen.getByRole("button", { name: /zkontrolovat a pokračovat/i }));

    expect(await screen.findByText("SkillStorm School")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /připojit se/i }));

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith("POST", "/invitations/accept", {
        body: { token: "VALID-123" },
      });
    });

    expect(clearOrgMock).toHaveBeenCalledWith("org-1");
    expect(syncProfileMock).toHaveBeenCalledWith({ force: true });
    expect(showToastOnceMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/app");
  });

  it("can fail and retry multiple times without stale state", async () => {
    vi.mocked(httpClient.get)
      .mockRejectedValueOnce(new Error("První neplatný kód."))
      .mockRejectedValueOnce(new Error("Druhý neplatný kód."));

    render(<JoinPage />);

    const input = screen.getByLabelText(/kód nebo token pozvánky/i);

    await userEvent.type(input, "BAD-1");
    await userEvent.click(screen.getByRole("button", { name: /zkontrolovat a pokračovat/i }));

    expect(await screen.findByText(/první neplatný kód/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /zkusit jiný kód/i }));

    const resetInput = await screen.findByLabelText(/kód nebo token pozvánky/i);
    expect(resetInput).toHaveValue("");
    expect(resetInput).toHaveFocus();

    await userEvent.type(resetInput, "BAD-2");
    await userEvent.click(screen.getByRole("button", { name: /zkontrolovat a pokračovat/i }));

    expect(await screen.findByText(/druhý neplatný kód/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /zkusit jiný kód/i }));

    const secondResetInput = await screen.findByLabelText(/kód nebo token pozvánky/i);
    expect(secondResetInput).toHaveValue("");
    expect(secondResetInput).toHaveFocus();
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
});
