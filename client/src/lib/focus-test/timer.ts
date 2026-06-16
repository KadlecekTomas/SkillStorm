// Pure timer math for Focus Test Mode. The deadline is anchored to the SERVER start
// (Submission.createdAt) and the assignment closeAt — never to the client clock offset.

export interface TimerInputs {
  /** Server-side attempt start (Submission.startedAt / createdAt), ISO string. */
  startedAt: string;
  /** Assignment.timeLimitSec, if any. */
  timeLimitSec: number | null;
  /** Assignment.closeAt, ISO string. */
  closeAt: string;
}

/**
 * Effective deadline = min(startedAt + timeLimitSec, closeAt).
 * Returns null when there is no time limit AND the close time is the only bound we surface
 * (we still return closeAt so the UI can always show a hard end).
 */
export function computeDeadlineMs(inputs: TimerInputs): number {
  const start = new Date(inputs.startedAt).getTime();
  const close = new Date(inputs.closeAt).getTime();
  if (inputs.timeLimitSec == null) return close;
  const limitDeadline = start + inputs.timeLimitSec * 1000;
  return Math.min(limitDeadline, close);
}

export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.round((deadlineMs - nowMs) / 1000));
}

export function formatRemaining(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
