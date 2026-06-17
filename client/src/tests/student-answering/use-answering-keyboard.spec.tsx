/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useAnsweringKeyboard } from "@/hooks/focus-test/use-answering-keyboard";

function Harness(
  props: Partial<Parameters<typeof useAnsweringKeyboard>[0]> & {
    optionCount?: number;
  },
): React.JSX.Element {
  useAnsweringKeyboard({
    onPrev: props.onPrev ?? vi.fn(),
    onNext: props.onNext ?? vi.fn(),
    onToggleFlag: props.onToggleFlag ?? vi.fn(),
    onOpenReview: props.onOpenReview ?? vi.fn(),
    onSelectOption: props.onSelectOption ?? vi.fn(),
    optionCount: props.optionCount ?? 4,
    enabled: props.enabled ?? true,
  });
  return <input data-testid="text" aria-label="text" />;
}

describe("useAnsweringKeyboard", () => {
  afterEach(cleanup);

  it("maps arrows to prev/next", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<Harness onPrev={onPrev} onNext={onNext} />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("maps digit keys to option selection within range", () => {
    const onSelectOption = vi.fn();
    render(<Harness onSelectOption={onSelectOption} optionCount={3} />);
    fireEvent.keyDown(window, { key: "2" });
    expect(onSelectOption).toHaveBeenCalledWith(1);
    // out of range is ignored
    fireEvent.keyDown(window, { key: "9" });
    expect(onSelectOption).toHaveBeenCalledTimes(1);
  });

  it("maps F / M to flag and Ctrl/Cmd+Enter to review", () => {
    const onToggleFlag = vi.fn();
    const onOpenReview = vi.fn();
    render(<Harness onToggleFlag={onToggleFlag} onOpenReview={onOpenReview} />);
    fireEvent.keyDown(window, { key: "f" });
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(onToggleFlag).toHaveBeenCalledTimes(1);
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });

  it("ignores single-key shortcuts while typing in a text field", () => {
    const onToggleFlag = vi.fn();
    const onSelectOption = vi.fn();
    const onNext = vi.fn();
    const { getByTestId } = render(
      <Harness
        onToggleFlag={onToggleFlag}
        onSelectOption={onSelectOption}
        onNext={onNext}
      />,
    );
    const input = getByTestId("text");
    input.focus();
    fireEvent.keyDown(input, { key: "f", target: input });
    fireEvent.keyDown(input, { key: "2", target: input });
    fireEvent.keyDown(input, { key: "ArrowRight", target: input });
    expect(onToggleFlag).not.toHaveBeenCalled();
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();

    // ...but Ctrl/Cmd+Enter still opens review from inside an input.
    const onOpenReview = vi.fn();
    cleanup();
    render(<Harness onOpenReview={onOpenReview} />);
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    const onNext = vi.fn();
    render(<Harness onNext={onNext} enabled={false} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
  });
});
