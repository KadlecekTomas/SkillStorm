import { afterAll, describe, expect, it } from 'vitest';
import { ensurePolicyScorecard, POLICY_CATEGORIES } from './policy.score';
import './policy.smoke.test';

describe('Policy Compliance Summary', () => {
  afterAll(() => {
    const score = ensurePolicyScorecard();
    const completion = score.total
      ? Math.round((score.passed / score.total) * 100)
      : 0;
    console.log(
      `\nPOLICY_COMPLETION=${completion}% (${score.passed}/${score.total})`,
    );

    for (const category of POLICY_CATEGORIES) {
      const bucket = score.byCategory[category];
      const pct = bucket.total
        ? Math.round((bucket.passed / bucket.total) * 100)
        : 0;
      console.log(` - ${category}: ${pct}% (${bucket.passed}/${bucket.total})`);
    }

    if (score.failures.length) {
      console.log('\n❌ Missing or failing policies:');
      for (const f of score.failures) {
        console.log(
          ` - [${f.category}] ${f.description} → ${f.details ?? 'no details'}`,
        );
      }
    } else {
      console.log('\n✅ All policies passed');
    }

    expect(score.total).toBeGreaterThan(0);
  });

  it('collects policy metrics', () => {
    expect(true).toBe(true);
  });
});
