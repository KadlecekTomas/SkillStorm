/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "@/lib/http/client";
import { useFocusEventLogger } from "@/hooks/focus-test/use-focus-event-logger";

const mockFetch = vi.mocked(fetchWithAuth);

function Harness(): null {
  useFocusEventLogger("s1");
  return null;
}

describe("useFocusEventLogger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ success: true } as never);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("ships a focus event to the backend after the flush debounce", async () => {
    render(<Harness />);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(mockFetch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [method, url, opts] = mockFetch.mock.calls[0]!;
    expect(method).toBe("POST");
    expect(url).toBe("/submissions/s1/focus-events");
    const body = (opts as { body: { events: Array<{ type: string }> } }).body;
    expect(body.events[0]?.type).toBe("window_blur");
  });

  it("deduplicates repeats of the same type within the window into one counted row", async () => {
    render(<Harness />);
    act(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("blur"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = (mockFetch.mock.calls[0]![2] as {
      body: { events: Array<{ type: string; count: number }> };
    }).body;
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.count).toBe(3);
  });

  it("never throws when the log request fails", async () => {
    mockFetch.mockImplementation(() => {
      const p = Promise.reject(new Error("network down"));
      p.catch(() => {}); // pre-handle so the rejection is never "unhandled"
      return p as never;
    });
    render(<Harness />);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
