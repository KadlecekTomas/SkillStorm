/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SaveStatusBadge } from "@/components/student-answering/save-status-badge";
import type { SaveStatus } from "@/lib/focus-test/types";

const CASES: Array<{ status: SaveStatus; text: RegExp }> = [
  { status: "idle", text: /připraveno/i },
  { status: "saving", text: /ukládám/i },
  { status: "saved", text: /uloženo/i },
  { status: "offline", text: /offline – uloženo v zařízení/i },
  { status: "error", text: /čeká na synchronizaci/i },
];

describe("SaveStatusBadge", () => {
  afterEach(cleanup);

  it.each(CASES)(
    "renders the %s state with label and data-status",
    ({ status, text }) => {
      render(<SaveStatusBadge status={status} />);
      const node = screen.getByTestId("save-status");
      expect(node.getAttribute("data-status")).toBe(status);
      expect(screen.getByText(text)).toBeInTheDocument();
    },
  );

  it("exposes a stable outer test id and aria-live region", () => {
    render(<SaveStatusBadge status="saving" />);
    expect(screen.getByTestId("save-status-badge")).toBeInTheDocument();
    expect(screen.getByTestId("save-status")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
