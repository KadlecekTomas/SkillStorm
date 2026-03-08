import { safePercent, ratioToPercent, toNumberOrNull } from './safe-percent';

describe('safePercent', () => {
  it('computes (numerator/denominator)*100 rounded to 1 dp', () => {
    expect(safePercent(1, 2)).toBe(50);
    expect(safePercent(1, 3)).toBe(33.3);
    expect(safePercent(2, 3)).toBe(66.7);
    expect(safePercent(0, 10)).toBe(0);
  });

  it('returns null when denominator is 0', () => {
    expect(safePercent(5, 0)).toBeNull();
  });

  it('returns null when denominator is negative', () => {
    expect(safePercent(5, -1)).toBeNull();
  });

  it('returns null when numerator is NaN', () => {
    expect(safePercent(NaN, 10)).toBeNull();
  });

  it('returns null when denominator is Infinity', () => {
    expect(safePercent(5, Infinity)).toBeNull();
  });

  // Key zero-data scenario from the domain contract
  it('assignedCount=0 → completionRate null (—)', () => {
    expect(safePercent(0, 0)).toBeNull(); // 0 submitted, 0 started
  });

  it('submittedCount=0, assignedCount>0 → completionRate 0%', () => {
    expect(safePercent(0, 5)).toBe(0); // 0 completed of 5 started
  });

  it('all submitted → 100%', () => {
    expect(safePercent(5, 5)).toBe(100);
  });
});

describe('ratioToPercent', () => {
  it('converts 0..1 ratio to 0..100 percent', () => {
    expect(ratioToPercent(0.5)).toBe(50);
    expect(ratioToPercent(0.833)).toBe(83.3);
    expect(ratioToPercent(1)).toBe(100);
    expect(ratioToPercent(0)).toBe(0);
  });

  it('returns null for null', () => {
    expect(ratioToPercent(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(ratioToPercent(undefined)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(ratioToPercent(NaN)).toBeNull();
  });

  // avgScore=null when no submissions exist
  it('score null (no submissions) → avgScorePercent null', () => {
    expect(ratioToPercent(null)).toBeNull();
  });
});

describe('toNumberOrNull', () => {
  it('returns finite number as-is', () => {
    expect(toNumberOrNull(42)).toBe(42);
    expect(toNumberOrNull(0)).toBe(0);
  });

  it('returns null for null/undefined', () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(toNumberOrNull(NaN)).toBeNull();
  });

  it('coerces numeric strings', () => {
    expect(toNumberOrNull('3.14')).toBe(3.14);
  });

  it('returns null for non-numeric strings', () => {
    expect(toNumberOrNull('abc')).toBeNull();
  });
});
