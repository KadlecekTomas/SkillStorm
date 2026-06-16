import { describe, expect, it } from "vitest";
import {
  computeDeadlineMs,
  formatRemaining,
  remainingSeconds,
} from "@/lib/focus-test/timer";

describe("computeDeadlineMs", () => {
  const startedAt = "2026-01-01T10:00:00.000Z";
  const start = new Date(startedAt).getTime();

  it("returns closeAt when there is no time limit", () => {
    const closeAt = "2026-01-01T12:00:00.000Z";
    expect(computeDeadlineMs({ startedAt, timeLimitSec: null, closeAt })).toBe(
      new Date(closeAt).getTime(),
    );
  });

  it("returns start + limit when that is earlier than closeAt", () => {
    const closeAt = "2026-01-01T12:00:00.000Z";
    expect(
      computeDeadlineMs({ startedAt, timeLimitSec: 600, closeAt }),
    ).toBe(start + 600_000);
  });

  it("clamps to closeAt when the limit would exceed it", () => {
    const closeAt = "2026-01-01T10:05:00.000Z";
    expect(
      computeDeadlineMs({ startedAt, timeLimitSec: 3600, closeAt }),
    ).toBe(new Date(closeAt).getTime());
  });
});

describe("remainingSeconds", () => {
  it("never goes negative", () => {
    expect(remainingSeconds(1000, 5000)).toBe(0);
    expect(remainingSeconds(5000, 1000)).toBe(4);
  });
});

describe("formatRemaining", () => {
  it("formats mm:ss and h:mm:ss", () => {
    expect(formatRemaining(65)).toBe("01:05");
    expect(formatRemaining(3661)).toBe("1:01:01");
  });
});
