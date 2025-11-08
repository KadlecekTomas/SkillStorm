import React from "react";
import { render, screen, act } from "@testing-library/react";
import { PermissionGate } from "@/components/access/permission-gate";
import { PermissionKey } from "@/types";
import { useAuthStore } from "@/store/use-auth-store";

describe("PermissionGate", () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        permissions: [],
        user: null,
        token: null,
        loading: false,
      } as any);
    });
  });

  it("renders fallback when permission missing", () => {
    render(
      <PermissionGate
        permission={PermissionKey.CREATE_TEST}
        fallback={<div data-testid="fallback">Blocked</div>}
      >
        <div data-testid="allowed">Allowed</div>
      </PermissionGate>,
    );

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });

  it("renders children when permission present", () => {
    act(() => {
      useAuthStore.setState({
        permissions: [PermissionKey.CREATE_TEST],
      } as any);
    });

    render(
      <PermissionGate permission={PermissionKey.CREATE_TEST}>
        <div data-testid="allowed">Allowed</div>
      </PermissionGate>,
    );

    expect(screen.getByTestId("allowed")).toBeInTheDocument();
  });
});
