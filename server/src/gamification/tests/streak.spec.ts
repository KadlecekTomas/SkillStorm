import { computeStreakDays } from '@/gamification/gamification.service';

function daysAgo(n: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe('computeStreakDays', () => {
  it('počítá po sobě jdoucí dny včetně dneška', () => {
    const events = [0, 1, 2, 3, 4, 5].map((n) => daysAgo(n));
    expect(computeStreakDays(events)).toBe(6);
  });

  it('mezera v sérii ji ukončuje', () => {
    // dny 0–5 aktivní, den 6 chybí, dny 7–10 aktivní → série 6
    const events = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10].map((n) => daysAgo(n));
    expect(computeStreakDays(events)).toBe(6);
  });

  it('dnešek bez aktivity sérii neláme — počítá od včerejška', () => {
    const events = [1, 2, 3].map((n) => daysAgo(n));
    expect(computeStreakDays(events)).toBe(3);
  });

  it('více událostí v jednom dni se počítá jednou', () => {
    const events = [daysAgo(0, 8), daysAgo(0, 14), daysAgo(1, 9)];
    expect(computeStreakDays(events)).toBe(2);
  });

  it('bez událostí je série nulová', () => {
    expect(computeStreakDays([])).toBe(0);
  });
});
