/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { CreateOrganizationOnboardingScreen } from "@/components/onboarding/CreateOrganizationOnboardingScreen";

const {
  replaceMock,
  postMock,
  syncProfileMock,
  switchToOrganizationByOrgIdMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  postMock: vi.fn(),
  syncProfileMock: vi.fn(),
  switchToOrganizationByOrgIdMock: vi.fn(),
}));

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

vi.mock("@/components/ui/select", () => {
  const Select = ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    disabled?: boolean;
  }) => {
    const options = Array.isArray(children) ? children : [children];
    const enabledValues = options
      .filter((child) => child?.props?.value && child?.props?.disabled !== true)
      .map((child) => child.props.value as string);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const currentIndex = enabledValues.indexOf(value ?? "");
      const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (fallbackIndex + delta + enabledValues.length) % enabledValues.length;
      const nextValue = enabledValues[nextIndex];
      if (nextValue) onValueChange?.(nextValue);
    };

    return (
      <select
        aria-label="Typ organizace"
        data-testid="org-type-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange?.(event.target.value)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </select>
    );
  };

  const SelectItem = ({
    value,
    children,
    disabled,
    ...props
  }: {
    value: string;
    children: ReactNode;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <option value={value} disabled={disabled} {...props}>
      {children}
    </option>
  );

  const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;

  return {
    Select,
    SelectContent: passthrough,
    SelectItem,
    SelectTrigger: passthrough,
    SelectValue: () => null,
  };
});

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

  it("shows unsupported organization types as disabled with 'Již brzy'", async () => {
    render(<CreateOrganizationOnboardingScreen />);

    const schoolOption = screen.getByTestId("org-type-option-SCHOOL");
    const communityOption = screen.getByTestId("org-type-option-COMMUNITY");
    const privateOption = screen.getByTestId("org-type-option-PRIVATE");

    expect(schoolOption).not.toBeDisabled();
    expect(communityOption).toBeDisabled();
    expect(privateOption).toBeDisabled();
    expect(screen.getAllByText("Již brzy")).toHaveLength(2);
  });

  it("submits the supported school option", async () => {
    postMock.mockResolvedValue({ id: "org-1", type: "SCHOOL" });
    switchToOrganizationByOrgIdMock.mockResolvedValue({ mode: "organization" });

    render(<CreateOrganizationOnboardingScreen />);

    fireEvent.change(screen.getByLabelText(/název organizace/i), {
      target: { value: "Supported School" },
    });
    fireEvent.click(screen.getByRole("button", { name: /vytvořit organizaci/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/organizations",
        { name: "Supported School", type: "SCHOOL" },
        expect.any(Object),
      );
    });
  });

  it("keyboard navigation skips disabled items", async () => {
    const user = userEvent.setup();
    render(<CreateOrganizationOnboardingScreen />);

    const trigger = screen.getByTestId("org-type-select");
    trigger.focus();

    await user.keyboard("[ArrowDown]");
    await user.keyboard("[ArrowDown]");
    await user.keyboard("[Enter]");

    expect(trigger).toHaveValue("SCHOOL");
    expect(screen.getByTestId("org-type-option-COMMUNITY")).toBeDisabled();
    expect(screen.getByTestId("org-type-option-PRIVATE")).toBeDisabled();
  });
});
