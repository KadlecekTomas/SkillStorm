/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReviewBeforeSubmitDialog } from "@/components/student-answering/review-before-submit-dialog";

const base = {
  open: true,
  onOpenChange: vi.fn(),
  answered: 3,
  total: 5,
  flagged: 1,
  online: true,
  hasUnsaved: false,
  saveStatus: "saved" as const,
  submitting: false,
  submitError: null,
};

describe("ReviewBeforeSubmitDialog", () => {
  afterEach(cleanup);

  it("summarises answered / unanswered / flagged counts", () => {
    render(<ReviewBeforeSubmitDialog {...base} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("review-submit-dialog")).toBeInTheDocument();
    // 5 total, 3 answered → 2 unanswered warning
    expect(screen.getByTestId("review-unanswered-warning")).toHaveTextContent(
      /2/,
    );
  });

  it("blocks submit while offline and shows an offline warning", () => {
    const onConfirm = vi.fn();
    render(
      <ReviewBeforeSubmitDialog
        {...base}
        online={false}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByTestId("review-offline-warning")).toHaveTextContent(
      /nelze ho odevzdat bez připojení k internetu/i,
    );
    const confirm = screen.getByTestId("confirm-submit") as HTMLButtonElement;
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("allows submit online and runs the confirm handler (force-sync owned by submit)", () => {
    const onConfirm = vi.fn();
    render(
      <ReviewBeforeSubmitDialog
        {...base}
        online
        hasUnsaved
        saveStatus="saving"
        onConfirm={onConfirm}
      />,
    );
    // Unsaved answers are flagged as syncing, but submit stays available online.
    const confirm = screen.getByTestId("confirm-submit") as HTMLButtonElement;
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("surfaces a submit error returned by the submit flow", () => {
    render(
      <ReviewBeforeSubmitDialog
        {...base}
        submitError="Odevzdání selhalo. Zkus to prosím znovu."
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId("review-submit-error")).toHaveTextContent(
      /odevzdání selhalo/i,
    );
  });
});
