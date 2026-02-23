/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiniProgressBlock } from "@/components/tests/mini-progress-block";

describe("MiniProgressBlock", () => {
  it("shows previous and current score and difference", () => {
    render(<MiniProgressBlock previousScore={0.6} currentScore={0.78} />);

    expect(screen.getByText(/60 %/)).toBeInTheDocument();
    expect(screen.getByText(/78 %/)).toBeInTheDocument();
    expect(screen.getByText(/\+18 %/)).toBeInTheDocument();
  });

  it("shows negative difference when score decreased", () => {
    render(<MiniProgressBlock previousScore={0.8} currentScore={0.65} />);

    expect(screen.getByText(/-15 %/)).toBeInTheDocument();
  });

  it("shows — for null previous score", () => {
    render(<MiniProgressBlock previousScore={null} currentScore={0.9} />);

    expect(screen.getByText("Porovnání s předchozím pokusem")).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
