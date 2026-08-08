/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import LegacyTestsPage from "@/app/(dashboard)/dashboard/tests/page";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirectMock(href),
}));

describe("legacy /dashboard/tests alias", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("vede vždy na jedinou kanonickou obrazovku testů", () => {
    render(<LegacyTestsPage />);

    expect(redirectMock).toHaveBeenCalledWith("/app/tests");
  });
});
