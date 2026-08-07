/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import LegacyDashboardPage from "@/app/(dashboard)/dashboard/page";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirectMock(href),
}));

describe("legacy /dashboard alias", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("vede vždy na jediný kanonický dashboard", () => {
    render(<LegacyDashboardPage />);

    expect(redirectMock).toHaveBeenCalledWith("/app");
  });
});
