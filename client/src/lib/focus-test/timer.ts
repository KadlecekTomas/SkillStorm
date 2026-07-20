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

const DAY_SECONDS = 24 * 3600;

function czechDayWord(days: number): string {
  if (days === 1) return "den";
  if (days <= 4) return "dny";
  return "dní";
}

/**
 * Popisek termínu bez časového limitu. Odpočet HH:MM:SS dává smysl jen pro
 * blízké termíny — "342:24:42" vypadá jako rozbitý časovač. Prahy:
 *   ≤ 24 h   → živý odpočet ("3:24:10")
 *   ≤ 30 dní → relativně ("za 14 dní")
 *   dál      → datum ("15. 8.")
 */
export function formatDeadlineLabel(
  totalSeconds: number,
  deadlineMs: number,
): string {
  if (totalSeconds <= DAY_SECONDS) return formatRemaining(totalSeconds);
  const days = Math.round(totalSeconds / DAY_SECONDS);
  if (days <= 30) return `za ${days} ${czechDayWord(days)}`;
  return new Date(deadlineMs).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  });
}
