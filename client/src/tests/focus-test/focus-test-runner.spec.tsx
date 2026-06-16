/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { FocusTestSession } from "@/lib/focus-test/types";
import { draftStorageKey } from "@/lib/focus-test/draft-storage";

vi.mock("@/lib/http/client", () => {
  class HttpError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data?: unknown) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }
  return { fetchWithAuth: vi.fn(), HttpError };
});

import { fetchWithAuth } from "@/lib/http/client";
import { FocusTestRunner } from "@/components/focus-test/focus-test-runner";

const mockFetch = vi.mocked(fetchWithAuth);

const nowISO = new Date().toISOString();
const future = new Date(Date.now() + 3_600_000).toISOString();

const makeSession = (): FocusTestSession => ({
  assignment: {
    id: "a1",
    title: "Demo test",
    openAt: new Date(Date.now() - 60_000).toISOString(),
    closeAt: future,
    maxAttempts: 3,
    timeLimitSec: null,
    showExplain: "after_close",
  },
  test: {
    id: "t1",
    title: "Demo test",
    description: null,
    questions: [
      { id: "q1", text: "Is 1 < 2?", type: "TRUE_FALSE", options: [] },
      {
        id: "q2",
        text: "Capital of France?",
        type: "FILL_IN_THE_BLANK",
        options: [],
      },
    ],
  },
  submission: {
    id: "s1",
    attemptNo: 1,
    status: "PENDING",
    startedAt: nowISO,
    updatedAt: nowISO,
    submittedAt: null,
  },
  responses: [],
});

const setOnline = (value: boolean): void => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
  act(() => {
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  });
};

describe("FocusTestRunner", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ success: true } as never);
    setOnline(true);
  });
  afterEach(() => {
    cleanup();
  });

  it("renders the distraction-free shell without dashboard navigation", () => {
    render(
      <FocusTestRunner session={makeSession()} onSubmitted={vi.fn()} onLeave={vi.fn()} />,
    );
    expect(screen.getByTestId("focus-test-root")).toBeTruthy();
    expect(screen.getByText("Demo test")).toBeTruthy();
    // No global app chrome leaks into the focus shell.
    expect(document.querySelector('[data-testid="app-sidebar"]')).toBeNull();
    expect(document.querySelector("nav[aria-label='Hlavní navigace']")).toBeNull();
  });

  it("autosaves a changed answer after the debounce window", async () => {
    vi.useFakeTimers();
    try {
      render(
        <FocusTestRunner
          session={makeSession()}
          onSubmitted={vi.fn()}
          onLeave={vi.fn()}
        />,
      );
      const ano = screen.getByDisplayValue("true") as HTMLInputElement;
      fireEvent.click(ano);
      expect(screen.getByTestId("save-status").getAttribute("data-status")).toBe(
        "saving",
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "PATCH",
        "/submissions/s1/responses",
        expect.objectContaining({
          body: expect.objectContaining({
            responses: [{ questionId: "q1", givenText: "true" }],
          }),
        }),
      );
      expect(
        screen.getByTestId("save-status").getAttribute("data-status"),
      ).toBe("saved");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an offline message and blocks submit while offline", async () => {
    render(
      <FocusTestRunner session={makeSession()} onSubmitted={vi.fn()} onLeave={vi.fn()} />,
    );
    setOnline(false);
    await screen.findByTestId("offline-indicator");
    expect(screen.getByText(/odpovědi jsou uložené v zařízení/i)).toBeTruthy();

    fireEvent.click(screen.getByTestId("submit-test"));
    await waitFor(() =>
      expect(
        screen.getByText(/nelze ho odevzdat bez připojení k internetu/i),
      ).toBeTruthy(),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      "POST",
      "/submissions/s1/finish",
      expect.anything(),
    );
  });

  it("submits online, then clears the local draft", async () => {
    const onSubmitted = vi.fn();
    render(
      <FocusTestRunner
        session={makeSession()}
        onSubmitted={onSubmitted}
        onLeave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByDisplayValue("true"));
    // a draft exists after answering
    await waitFor(() =>
      expect(localStorage.getItem(draftStorageKey("a1", "s1"))).not.toBeNull(),
    );

    fireEvent.click(screen.getByTestId("submit-test"));
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith("s1"),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "POST",
      "/submissions/s1/finish",
      expect.anything(),
    );
    expect(localStorage.getItem(draftStorageKey("a1", "s1"))).toBeNull();
  });

  it("restores a newer local draft on mount (refresh recovery)", async () => {
    localStorage.setItem(
      draftStorageKey("a1", "s1"),
      JSON.stringify({
        assignmentId: "a1",
        submissionId: "s1",
        answers: { q2: "Praha" },
        updatedAt: Date.now() + 100_000,
        dirtyQuestionIds: ["q2"],
        clientVersion: 3,
      }),
    );
    render(
      <FocusTestRunner session={makeSession()} onSubmitted={vi.fn()} onLeave={vi.fn()} />,
    );
    // let the mount-time auto-sync of the restored dirty draft settle
    await act(async () => {
      await Promise.resolve();
    });
    // jump to question 2
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect((screen.getByDisplayValue("Praha") as HTMLInputElement).value).toBe(
      "Praha",
    );
  });
});
