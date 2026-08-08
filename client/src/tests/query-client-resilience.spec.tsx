/** @vitest-environment jsdom */

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryClient, useQuery } from "@/lib/query-client";

function Probe({ queryFn }: { queryFn: () => Promise<string> }) {
  const { data, error } = useQuery({ queryKey: ["query-resilience"], queryFn, staleTime: 60_000 });
  return (<div><span data-testid="data">{data ?? "none"}</span><span data-testid="error">{error instanceof Error ? error.message : "none"}</span></div>);
}

describe("query client resilience", () => {
  beforeEach(() => { queryClient.clear(); });
  it("does not turn a failed request into an automatic retry storm", async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error("offline"));
    render(<Probe queryFn={queryFn} />);
    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("offline"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
  it("still refetches once when the query is explicitly invalidated", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    render(<Probe queryFn={queryFn} />);
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("first"));
    act(() => queryClient.invalidateQueries(["query-resilience"]));
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("second"));
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
